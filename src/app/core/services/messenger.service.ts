import { Injectable, inject, signal } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { ChatThread, ChatMessage } from '../models/message.model';
import { Observable, of, throwError, timer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class MessengerService extends BaseApiService {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  public unreadThreadsCount = signal<number>(0);
  public activeThreadId = signal<string | null>(null);
  private lastNotifiedMessages = new Map<string, string>();

  constructor() {
    super();
    this.startPolling();
  }

  private startPolling() {
    timer(0, 10000).pipe(
      catchError(() => of([]))
    ).subscribe(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.getChatThreads(user.id).pipe(
          catchError(() => of([]))
        ).subscribe();
      } else {
        this.unreadThreadsCount.set(0);
      }
    });
  }

  getChatThreads(userId: string): Observable<ChatThread[]> {
    const role = this.auth.currentUser()?.role || 'customer';
    const otherRole = role === 'customer' ? 'vendor' : 'customer';

    return this.get<any[]>(API_ROUTES.MESSENGER.THREADS).pipe(
      map(threads => {
        const mapped = threads.map(t => ({
          id: t.ThreadId,
          subject: t.RecipientName,
          lastMessage: t.LastMessage,
          lastMessageTime: t.UpdatedAt,
          unreadCount: t.UnreadCount,
          status: t.Status,
          participants: [
            { id: userId, name: 'Me', role: role },
            { id: t.RecipientId, name: t.RecipientName, role: otherRole }
          ]
        } as ChatThread));

        const totalUnread = mapped.filter(t => t.unreadCount > 0).length;
        this.unreadThreadsCount.set(totalUnread);

        mapped.forEach(t => {
          if (t.unreadCount > 0 && t.id !== this.activeThreadId()) {
            const lastTime = this.lastNotifiedMessages.get(t.id);
            if (lastTime !== t.lastMessageTime) {
              this.lastNotifiedMessages.set(t.id, t.lastMessageTime);
              this.toast.info(`New message from ${t.subject}: "${t.lastMessage}"`);
            }
          } else {
            this.lastNotifiedMessages.set(t.id, t.lastMessageTime);
          }
        });

        return mapped;
      })
    );
  }

  getChatMessages(threadId: string): Observable<ChatMessage[]> {
    const currentUser = this.auth.currentUser();
    const role = currentUser?.role || 'customer';
    const otherRole = role === 'customer' ? 'vendor' : 'customer';

    return this.get<any[]>(API_ROUTES.MESSENGER.MESSAGES(threadId)).pipe(
      map(msgs => msgs.map(m => ({
        id: m.MessageId,
        threadId: m.ThreadId,
        senderId: m.SenderId,
        content: m.Content,
        timestamp: m.Timestamp,
        senderRole: m.SenderId?.toLowerCase() === currentUser?.id?.toLowerCase() ? role : otherRole,
        isRead: true,
        type: 'text'
      } as ChatMessage))),
      catchError(error => {
        if (error.status === 404) {
          return of([]);
        }
        return throwError(() => error);
      })
    );
  }

  sendMessage(msg: Partial<ChatMessage>): Observable<ChatMessage> {
    const role = this.auth.currentUser()?.role || 'customer';
    return this.post<any>(API_ROUTES.MESSENGER.MESSAGES(msg.threadId!), {
      Content: msg.content
    }).pipe(
      map(m => ({
        id: m.MessageId,
        threadId: m.ThreadId,
        senderId: m.SenderId,
        content: m.Content,
        timestamp: m.Timestamp,
        senderRole: role,
        isRead: true,
        type: 'text'
      } as ChatMessage))
    );
  }

  requestChat(vendorId: string, rfpId?: string | null, message?: string | null): Observable<{ threadId: string, status: string }> {
    let url = `${API_ROUTES.MESSENGER.REQUEST}?vendorId=${vendorId}`;
    if (rfpId) {
      url += `&rfpId=${rfpId}`;
    }
    const headers = { 'Content-Type': 'application/json', 'X-Suppress-Errors': 'true' };
    return this.http.post<{ threadId: string, status: string }>(
      `${this.baseUrl}${url}`,
      message ? JSON.stringify(message) : null,
      { headers }
    );
  }

  acceptChat(threadId: string): Observable<{ success: boolean }> {
    return this.post<{ success: boolean }>(API_ROUTES.MESSENGER.ACCEPT(threadId), {});
  }

  rejectChat(threadId: string): Observable<{ success: boolean }> {
    return this.post<{ success: boolean }>(API_ROUTES.MESSENGER.REJECT(threadId), {});
  }

  markAsRead(threadId: string): Observable<boolean> {
    return this.post<{ success: boolean }>(API_ROUTES.MESSENGER.READ(threadId), {}).pipe(
      map(res => res.success),
      catchError(() => of(false))
    );
  }

  isThreadAlive(threadId: string): Observable<boolean> {
    return this.get<any>(API_ROUTES.MESSENGER.ALIVE(threadId)).pipe(
      map(res => res.isAlive)
    );
  }
}
