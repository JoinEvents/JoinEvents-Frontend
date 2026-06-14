import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'booking' | 'message' | 'payment' | 'verification' | 'system';
  isRead: boolean;
  createdAt: string;
  targetRole: 'customer' | 'vendor' | 'admin' | 'support';
  targetUserId?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = environment.apiUrl;

  private notificationsList = signal<NotificationItem[]>([
    { id: 'notif-init-1', title: 'Booking Confirmed', message: 'Your booking for Wedding Reception has been confirmed.', type: 'booking', isRead: false, createdAt: '2026-05-07T21:00:00.000Z', targetRole: 'customer', targetUserId: 'c1' },
    { id: 'notif-init-2', title: 'New Message', message: 'You have a new message from Priya Nair regarding your event.', type: 'message', isRead: false, createdAt: '2026-05-07T20:30:00.000Z', targetRole: 'customer', targetUserId: 'c1' },
    { id: 'notif-init-3', title: 'Payment Received', message: 'Advance payment for Gruhapravesh Puja received successfully.', type: 'payment', isRead: true, createdAt: '2026-05-07T18:00:00.000Z', targetRole: 'customer', targetUserId: 'c1' },
    { id: 'notif-init-4', title: 'Verification Update', message: 'Your vendor verification is now in progress.', type: 'verification', isRead: true, createdAt: '2026-05-07T12:00:00.000Z', targetRole: 'vendor', targetUserId: 'v1' },
    { id: 'notif-init-5', title: 'New Booking Request', message: 'You have received a new booking request for Grand Wedding Hall on June 12th.', type: 'booking', isRead: false, createdAt: '2026-05-07T21:10:00.000Z', targetRole: 'vendor', targetUserId: 'v1' }
  ]);

  // Expose signal of active notifications for currently logged in role
  activeNotifications = computed(() => {
    const user = this.auth.currentUser();
    const list = this.notificationsList();
    if (!user) {
      return [];
    }
    return list
      .filter(n => n.targetRole === user.role && (!n.targetUserId || n.targetUserId === user.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  unreadCount = computed(() => {
    return this.activeNotifications().filter(n => !n.isRead).length;
  });

  constructor() {
    // On instantiation, check if we have any pending notifications in sessionStorage for potential login
    const user = this.auth.currentUser();
    if (user) {
      this.loadPendingSessionNotifications(user.id);
    }

    // Automatically fetch notifications from backend whenever the current user changes
    effect(() => {
      const currentUser = this.auth.currentUser();
      if (currentUser) {
        this.fetchNotifications();
      }
    }, { allowSignalWrites: true });
  }

  fetchNotifications() {
    const user = this.auth.currentUser();
    if (!user) return;

    this.http.get<any[]>(`${this.apiUrl}/notifications`).subscribe({
      next: (list) => {
        const items: NotificationItem[] = list.map(n => {
          const rawType = (n.type || n.Type || 'system').toLowerCase();
          const allowedTypes = ['booking', 'message', 'payment', 'verification', 'system'];
          const type = allowedTypes.includes(rawType) ? (rawType as any) : 'system';
          
          return {
            id: n.id || n.Id,
            title: n.title || n.Title,
            message: n.message || n.Message,
            type,
            isRead: n.isRead !== undefined ? n.isRead : n.IsRead,
            createdAt: n.createdAt || n.CreatedAt || new Date().toISOString(),
            targetRole: user.role,
            targetUserId: user.id
          };
        });

        // Merge with existing notifications to keep local ones, avoiding duplicates
        this.notificationsList.update(curr => {
          const merged = [...curr];
          items.forEach(item => {
            if (!merged.some(m => m.id === item.id)) {
              merged.push(item);
            }
          });
          return merged;
        });
      },
      error: (err) => console.error('Failed to fetch notifications from backend', err)
    });
  }

  addNotification(n: Omit<NotificationItem, 'id' | 'isRead' | 'createdAt'>) {
    const newNotif: NotificationItem = {
      ...n,
      id: 'notif-' + Math.floor(Math.random() * 100000),
      isRead: false,
      createdAt: new Date().toISOString()
    };

    const user = this.auth.currentUser();
    if (!user) {
      // Store in sessionStorage keyed by target user's ID
      if (newNotif.targetUserId) {
        const key = `pending_notifs_${newNotif.targetUserId}`;
        try {
          const stored = sessionStorage.getItem(key);
          const list = stored ? JSON.parse(stored) : [];
          list.push(newNotif);
          sessionStorage.setItem(key, JSON.stringify(list));
        } catch {}
      }
    } else {
      this.notificationsList.update(curr => [newNotif, ...curr]);
    }

    // Simulate email alert
    if (newNotif.type === 'booking' || newNotif.type === 'payment') {
      this.simulateEmail(newNotif);
    }
  }

  markAsRead(id: string) {
    this.notificationsList.update(list =>
      list.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  onNotificationClick(n: NotificationItem) {
    this.markAsRead(n.id);
    const role = this.auth.currentUser()?.role || 'customer';
    
    if (role === 'vendor') {
      if (n.type === 'booking') {
        this.router.navigate(['/vendor/bookings']);
      } else if (n.type === 'message') {
        this.router.navigate(['/vendor/messages']);
      } else if (n.type === 'payment') {
        this.router.navigate(['/vendor/finance']);
      } else if (n.type === 'verification') {
        this.router.navigate(['/vendor/verification']);
      } else {
        this.router.navigate(['/vendor/notifications']);
      }
    } else {
      // Customer
      if (n.type === 'booking') {
        this.router.navigate(['/bookings']);
      } else if (n.type === 'message') {
        this.router.navigate(['/messages']);
      } else if (n.type === 'payment') {
        this.router.navigate(['/payments']);
      } else if (n.type === 'system' || n.title.toLowerCase().includes('referral') || n.message.toLowerCase().includes('referral') || n.message.toLowerCase().includes('points')) {
        this.router.navigate(['/rewards']);
      } else {
        this.router.navigate(['/notifications']);
      }
    }
  }

  markAllAsRead() {
    const user = this.auth.currentUser();
    if (!user) return;
    this.notificationsList.update(list =>
      list.map(n => {
        if (n.targetRole === user.role && (!n.targetUserId || n.targetUserId === user.id)) {
          return { ...n, isRead: true };
        }
        return n;
      })
    );

    // Call backend API
    this.http.put(`${this.apiUrl}/notifications/read-all`, {}).subscribe({
      error: (err) => console.error('Failed to mark all as read in backend', err)
    });
  }

  deleteNotification(id: string) {
    this.notificationsList.update(list => list.filter(n => n.id !== id));
    
    // Call backend API to delete from DB
    this.http.delete(`${this.apiUrl}/notifications/${id}`).subscribe({
      error: (err) => console.error(`Failed to delete notification ${id} in backend`, err)
    });
  }

  clearAllNotifications() {
    const user = this.auth.currentUser();
    if (!user) return;
    
    // Update local state
    this.notificationsList.update(list =>
      list.filter(n => !(n.targetRole === user.role && (!n.targetUserId || n.targetUserId === user.id)))
    );
    
    // Call backend API to clear all from DB
    this.http.delete(`${this.apiUrl}/notifications/clear-all`).subscribe({
      error: (err) => console.error('Failed to clear all notifications in backend', err)
    });
  }

  loadPendingSessionNotifications(userId: string) {
    const key = `pending_notifs_${userId}`;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const list: NotificationItem[] = JSON.parse(stored);
        this.notificationsList.update(curr => [...list, ...curr]);
        sessionStorage.removeItem(key);
      }
    } catch {}
  }

  // Trigger methods as per Acceptance Criteria
  triggerBookingStatusTransition(bookingId: string, customerId: string, vendorId: string | undefined, oldStatus: string, newStatus: string) {
    const validTransitions = [
      { from: 'pending', to: 'confirmed' },
      { from: 'pending', to: 'cancelled' },
      { from: 'confirmed', to: 'cancelled' },
      { from: 'confirmed', to: 'completed' }
    ];
    const match = validTransitions.some(t => t.from === oldStatus && t.to === newStatus);
    if (!match) return;

    this.addNotification({
      title: 'Booking Status Updated',
      message: `Your booking for ${bookingId} has transitioned from ${oldStatus} to ${newStatus}.`,
      type: 'booking',
      targetRole: 'customer',
      targetUserId: customerId
    });

    if (vendorId) {
      this.addNotification({
        title: 'Booking Status Updated',
        message: `Booking ${bookingId} has transitioned from ${oldStatus} to ${newStatus}.`,
        type: 'booking',
        targetRole: 'vendor',
        targetUserId: vendorId
      });
    }
  }

  triggerNewMessageNotification(threadId: string, senderId: string, senderName: string, recipientId: string, recipientRole: 'customer' | 'vendor' | 'admin' | 'support') {
    this.addNotification({
      title: 'New Chat Message',
      message: `New message in thread ${threadId} from ${senderName}`,
      type: 'message',
      targetRole: recipientRole,
      targetUserId: recipientId
    });
  }

  triggerAdvancePaymentNotification(bookingId: string, customerId: string, amount: number) {
    this.addNotification({
      title: 'Advance Payment Confirmed',
      message: `Advance payment of ₹${amount} for booking ${bookingId} has been successfully recorded.`,
      type: 'payment',
      targetRole: 'customer',
      targetUserId: customerId
    });

    this.addNotification({
      title: 'New Platform Payment',
      message: `Advance payment of ₹${amount} received for booking ${bookingId}.`,
      type: 'payment',
      targetRole: 'admin'
    });
  }

  triggerVendorVerificationNotification(vendorId: string, status: string) {
    this.addNotification({
      title: 'Verification Status Updated',
      message: `Your vendor verification status has changed to: ${status}`,
      type: 'verification',
      targetRole: 'vendor',
      targetUserId: vendorId
    });
  }

  private simulateEmail(n: NotificationItem) {
    if (!environment.production) {
      const recipient = n.targetRole === 'customer' ? 'customer@demo.com' : n.targetRole === 'vendor' ? 'vendor@demo.com' : 'admin@demo.com';
      console.log('%c[Email Simulation]', 'color: #3b82f6; font-weight: bold;', {
        recipient,
        subject: `JoinEvents Notification: ${n.title}`,
        body: n.message
      });
    }
  }
}
