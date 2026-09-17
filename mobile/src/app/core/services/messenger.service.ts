import { Injectable, signal } from '@angular/core';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

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
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
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
  readonly threads = signal<ChatThread[]>([]);
  readonly totalUnread = signal(0);

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
   * Polls an open conversation. The backend has no socket channel today, so
   * the chat screen subscribes to this while visible and unsubscribes on leave
   * — polling a closed screen would drain the battery for nothing.
   */
  pollMessages(threadId: string): Observable<ChatMessage[]> {
    return timer(0, environment.chatPollSeconds * 1000).pipe(switchMap(() => this.getMessages(threadId)));
  }

  send(threadId: string, body: string, attachmentUrl?: string): Observable<ChatMessage | null> {
    return this.post<unknown>(API_ROUTES.MESSENGER.MESSAGES(threadId), { body, attachmentUrl }, false).pipe(
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

  private toThread(t: Record<string, unknown>): ChatThread {
    return {
      id: String(t['id'] ?? t['threadId'] ?? ''),
      participantId: String(t['participantId'] ?? t['vendorId'] ?? t['customerId'] ?? ''),
      participantName: String(t['participantName'] ?? t['vendorName'] ?? t['customerName'] ?? 'Conversation'),
      participantAvatar: t['participantAvatar'] as string | undefined,
      participantRole: t['participantRole'] as string | undefined,
      lastMessage: String(t['lastMessage'] ?? t['lastMessageBody'] ?? ''),
      lastMessageAt: String(t['lastMessageAt'] ?? t['updatedAt'] ?? new Date().toISOString()),
      unreadCount: Number(t['unreadCount'] ?? 0),
      status: (String(t['status'] ?? 'accepted').toLowerCase() as ChatThread['status']),
      rfpId: t['rfpId'] as string | undefined,
      bookingId: t['bookingId'] as string | undefined
    };
  }

  private toMessage(m: Record<string, unknown>, threadId: string): ChatMessage {
    return {
      id: String(m['id'] ?? m['messageId'] ?? crypto.randomUUID()),
      threadId: String(m['threadId'] ?? threadId),
      senderId: String(m['senderId'] ?? ''),
      senderName: m['senderName'] as string | undefined,
      body: String(m['body'] ?? m['message'] ?? m['content'] ?? ''),
      sentAt: String(m['sentAt'] ?? m['createdAt'] ?? new Date().toISOString()),
      isRead: Boolean(m['isRead'] ?? false),
      attachmentUrl: m['attachmentUrl'] as string | undefined
    };
  }
}
