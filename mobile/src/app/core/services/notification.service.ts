import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { RealtimeService } from './realtime.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

export type NotificationType = 'booking' | 'message' | 'payment' | 'verification' | 'system';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  entityId?: string;
}

/** Icon and accent per notification type, matching the web app's mapping. */
export const NOTIFICATION_META: Record<NotificationType, { icon: string; color: string }> = {
  booking: { icon: 'calendar', color: '#FF6B35' },
  message: { icon: 'chatbubble-ellipses', color: '#3B82F6' },
  payment: { icon: 'card', color: '#10B981' },
  verification: { icon: 'shield-checkmark', color: '#8B5CF6' },
  system: { icon: 'server', color: '#EF4444' }
};

@Injectable({ providedIn: 'root' })
export class NotificationService extends BaseApiService {
  readonly items = signal<NotificationItem[]>([]);
  readonly unreadCount = computed(() => this.items().filter(n => !n.isRead).length);
  readonly loading = signal(false);

  private realtime = inject(RealtimeService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  constructor() {
    super();
    // Notifications arrive the moment the server raises them (a booking confirmed, a payment made).
    this.realtime.notifications$.subscribe(n => {
      const [item] = this.normalize([n]);
      if (!item || this.items().some(existing => existing.id === item.id)) return;
      this.items.update(list => [item, ...list]);
      void this.toast.info(item.body ? `${item.title}: ${item.body}` : item.title);
    });
  }

  /** Fire-and-forget refresh, used by push handlers and tab entry. */
  refresh(): void {
    this.fetch().subscribe();
  }

  fetch(): Observable<NotificationItem[]> {
    this.loading.set(true);
    return this.get<unknown>(API_ROUTES.NOTIFICATIONS.BASE).pipe(
      map(res => this.normalize(res)),
      tap(items => {
        this.items.set(items);
        this.loading.set(false);
      }),
      catchError(() => {
        this.loading.set(false);
        return of([] as NotificationItem[]);
      })
    );
  }

  markAsRead(id: string): Observable<boolean> {
    this.items.update(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    return this.patch<unknown>(`${API_ROUTES.NOTIFICATIONS.BASE}/${id}/read`, {}).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  markAllAsRead(): Observable<boolean> {
    this.items.update(list => list.map(n => ({ ...n, isRead: true })));
    return this.post<unknown>(API_ROUTES.NOTIFICATIONS.READ_ALL, {}).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  remove(id: string): Observable<boolean> {
    this.items.update(list => list.filter(n => n.id !== id));
    return this.delete<unknown>(`${API_ROUTES.NOTIFICATIONS.BASE}/${id}`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  clearAll(): Observable<boolean> {
    this.items.set([]);
    return this.delete<unknown>(API_ROUTES.NOTIFICATIONS.BASE).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  meta(type: NotificationType) {
    return NOTIFICATION_META[type] ?? { icon: 'notifications', color: '#6366F1' };
  }

  private normalize(res: unknown): NotificationItem[] {
    const payload = res as { data?: unknown[] } | unknown[] | null;
    const list = Array.isArray(payload) ? payload : (payload?.data ?? []);
    return (list as Record<string, unknown>[]).map(n => ({
      id: String(n['id'] ?? n['notificationId'] ?? ''),
      type: toType(n['type']),
      title: String(n['title'] ?? 'Notification'),
      body: String(n['body'] ?? n['message'] ?? ''),
      isRead: Boolean(n['isRead'] ?? n['read'] ?? false),
      createdAt: String(n['createdAt'] ?? new Date().toISOString()),
      link: (n['link'] as string) ?? notificationLink(this.auth.role(), String(n['type'] ?? '')),
      entityId: (n['entityId'] as string) ?? undefined
    }));
  }
}

const TYPES: NotificationType[] = ['booking', 'message', 'payment', 'verification', 'system'];

/** The server's types are free text ("Booking", "booking_confirmed", …); map them onto the icons we have. */
function toType(raw: unknown): NotificationType {
  const value = String(raw ?? '').toLowerCase();
  return TYPES.find(t => value.includes(t)) ?? (value.includes('chat') ? 'message' : 'system');
}

/**
 * Where a notification opens in the app, per role and type: the same screens the API's push
 * links open (EventEase/Push/PushLinks.cs), so the list and a tapped push agree.
 */
export function notificationLink(role: string | null, kind: string): string {
  const k = (kind || '').toLowerCase();
  const map: Record<string, Record<string, string>> = {
    customer: { booking: '/customer/tabs/bookings', dispute: '/customer/tabs/bookings', message: '/customer/tabs/messages',
                payment: '/customer/payments', support: '/customer/support', rfp: '/customer/quotes' },
    vendor: { booking: '/vendor/tabs/bookings', dispute: '/vendor/tabs/bookings', message: '/vendor/messages',
              payment: '/vendor/finance', verification: '/vendor/verification', rfp: '/vendor/tabs/quote-board' },
    support: { booking: '/support/tabs/bookings', dispute: '/support/tabs/bookings', verification: '/support/tabs/verifications',
               support: '/support/tabs/tickets' },
    admin: { booking: '/admin/tabs/bookings', dispute: '/admin/disputes', verification: '/admin/verifications' }
  };
  const area = role && map[role] ? role : 'customer';
  return map[area][k] ?? `/${area}/notifications`;
}
