import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, timer } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';

import { RealtimeService } from './realtime.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { environment } from '../../../environments/environment';

export interface ChatThread {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantRole?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  /** pending → the vendor has not answered yet; active/accepted → open; rejected/closed → locked. */
  status: 'pending' | 'accepted' | 'active' | 'rejected' | 'closed' | 'expired';
  /** The booked event or quote request the conversation is about. */
  eventTitle?: string;
  rfpId?: string;
  bookingId?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName?: string;
  body: string;
  sentAt: string;
  isRead: boolean;
  attachmentUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class MessengerService extends BaseApiService {
  private realtime = inject(RealtimeService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  /** The conversation on screen, so a message there does not also raise a toast. */
  readonly activeThreadId = signal<string | null>(null);

  readonly threads = signal<ChatThread[]>([]);
  readonly totalUnread = signal(0);

  /** Messages in any of the user's conversations, the moment they are sent. */
  readonly liveMessages$: Observable<ChatMessage> = this.realtime.messages$.pipe(
    map(m => ({
      id: m.messageId,
      threadId: m.threadId,
      senderId: m.senderId,
      senderName: m.senderName,
      body: m.content,
      sentAt: m.timestamp,
      isRead: false
    }))
  );

  constructor() {
    super();
    // A new message refreshes the conversation list and the unread badges, and is announced
    // unless it is the user's own or the conversation is already open.
    this.realtime.messages$.subscribe(m => {
      this.getThreads().subscribe();
      if (m.senderId === this.auth.currentUser()?.id || m.threadId === this.activeThreadId()) return;
      const preview = m.content.length > 60 ? m.content.slice(0, 57) + '…' : m.content;
      void this.toast.info(`${m.senderName || 'New message'}: ${preview}`);
    });
  }

  getThreads(): Observable<ChatThread[]> {
    return this.get<unknown>(API_ROUTES.MESSENGER.THREADS).pipe(
      map(res => this.unwrap(res).map(t => this.toThread(t))),
      tap(threads => {
        this.threads.set(threads);
        this.totalUnread.set(threads.reduce((sum, t) => sum + t.unreadCount, 0));
      }),
      catchError(() => of([] as ChatThread[]))
    );
  }

  getMessages(threadId: string): Observable<ChatMessage[]> {
    return this.get<unknown>(API_ROUTES.MESSENGER.MESSAGES(threadId)).pipe(
      map(res => this.unwrap(res).map(m => this.toMessage(m, threadId))),
      catchError(() => of([] as ChatMessage[]))
    );
  }

  /**
   * Loads an open conversation, then refreshes it only while the live connection is down:
   * messages normally arrive over the hub (liveMessages$).
   */
  pollMessages(threadId: string): Observable<ChatMessage[]> {
    return timer(0, environment.chatPollSeconds * 1000).pipe(
      filter(tick => tick === 0 || !this.realtime.connected()),
      switchMap(() => this.getMessages(threadId))
    );
  }

  send(threadId: string, body: string): Observable<ChatMessage | null> {
    // The API names the text "Content"; the app used to send "body", so messages went out empty.
    return this.post<unknown>(API_ROUTES.MESSENGER.MESSAGES(threadId), { content: body }, false).pipe(
      map(res => this.toMessage(this.single(res), threadId)),
      catchError(() => of(null))
    );
  }

  requestChat(vendorId: string, rfpId?: string | null, message?: string | null): Observable<{ threadId: string; status: string } | null> {
    return this.post<{ threadId: string; status: string }>(API_ROUTES.MESSENGER.REQUEST, { vendorId, rfpId, message }, false).pipe(
      catchError(() => of(null))
    );
  }

  accept(threadId: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.MESSENGER.ACCEPT(threadId), {}));
  }

  reject(threadId: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.MESSENGER.REJECT(threadId), {}));
  }

  markAsRead(threadId: string): Observable<boolean> {
    this.threads.update(list => list.map(t => (t.id === threadId ? { ...t, unreadCount: 0 } : t)));
    this.totalUnread.set(this.threads().reduce((sum, t) => sum + t.unreadCount, 0));
    return this.ok(this.post<unknown>(API_ROUTES.MESSENGER.READ(threadId), {}));
  }

  /** A thread expires once its booking window closes; the composer locks then. */
  isAlive(threadId: string): Observable<boolean> {
    return this.get<{ alive?: boolean; isAlive?: boolean }>(API_ROUTES.MESSENGER.ALIVE(threadId)).pipe(
      map(res => Boolean(res?.alive ?? res?.isAlive ?? false)),
      catchError(() => of(false))
    );
  }

  // ---- internals -------------------------------------------------------

  private ok(source: Observable<unknown>): Observable<boolean> {
    return source.pipe(map(() => true), catchError(() => of(false)));
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? []) as Record<string, unknown>[]);
  }

  private single(res: unknown): Record<string, unknown> {
    const payload = res as { data?: unknown } | null;
    return ((payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) ?? {}) as Record<string, unknown>;
  }

  /** The API's thread preview: ThreadId, RecipientId, RecipientName, … (camel-cased on arrival). */
  private toThread(t: Record<string, unknown>): ChatThread {
    return {
      id: String(t['threadId'] ?? t['id'] ?? ''),
      participantId: String(t['recipientId'] ?? t['participantId'] ?? ''),
      participantName: String(t['recipientName'] ?? t['participantName'] ?? 'Conversation'),
      participantAvatar: (t['recipientAvatar'] ?? t['participantAvatar']) as string | undefined,
      participantRole: t['participantRole'] as string | undefined,
      lastMessage: String(t['lastMessage'] ?? ''),
      lastMessageAt: String(t['updatedAt'] ?? t['lastMessageAt'] ?? new Date().toISOString()),
      unreadCount: Number(t['unreadCount'] ?? 0),
      status: (String(t['status'] ?? 'accepted').toLowerCase() as ChatThread['status']),
      rfpId: (t['rfpId'] as string | null) ?? undefined,
      eventTitle: (t['eventTitle'] as string | null) ?? undefined
    };
  }

  private toMessage(m: Record<string, unknown>, threadId: string): ChatMessage {
    return {
      id: String(m['messageId'] ?? m['id'] ?? crypto.randomUUID()),
      threadId: String(m['threadId'] ?? threadId),
      senderId: String(m['senderId'] ?? ''),
      senderName: m['senderName'] as string | undefined,
      body: String(m['content'] ?? m['body'] ?? m['message'] ?? ''),
      sentAt: String(m['timestamp'] ?? m['sentAt'] ?? m['createdAt'] ?? new Date().toISOString()),
      isRead: Boolean(m['isRead'] ?? false),
      attachmentUrl: m['attachmentUrl'] as string | undefined
    };
  }
}
