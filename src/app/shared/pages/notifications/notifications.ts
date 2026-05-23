import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../components/confirm-dialog';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class NotificationsPage implements OnInit {
  private confirmService = inject(ConfirmService);
  private auth = inject(AuthService);
  private notificationService = inject(NotificationService);

  categories = signal<string[]>(['All']);
  activeFilter = signal('All');

  ngOnInit() {
    const role = this.auth.currentUser()?.role || 'customer';
    if (role === 'vendor') {
      this.categories.set(['All', 'Booking', 'Payment', 'Message', 'Verification', 'System']);
    } else if (role === 'admin') {
      this.categories.set(['All', 'Booking', 'Payment', 'System']);
    } else {
      this.categories.set(['All', 'Booking', 'Payment', 'Message', 'System']);
    }
  }

  getTypeMeta(type: string) {
    const meta: Record<string, { category: string; color: string; icon: string }> = {
      booking: { category: 'Booking', color: '#FF6B35', icon: 'bi-calendar-check' },
      message: { category: 'Message', color: '#3B82F6', icon: 'bi-chat-dots' },
      payment: { category: 'Payment', color: '#10B981', icon: 'bi-cash-stack' },
      verification: { category: 'Verification', color: '#8B5CF6', icon: 'bi-shield-check' },
      system: { category: 'System', color: '#EF4444', icon: 'bi-server' }
    };
    return meta[type] || { category: 'System', color: '#6366F1', icon: 'bi-bell' };
  }

  filteredNotifications = computed(() => {
    const rawList = this.notificationService.activeNotifications();
    const currentFilter = this.activeFilter();

    const mapped = rawList.map(n => {
      const meta = this.getTypeMeta(n.type);
      return {
        ...n,
        category: meta.category,
        color: meta.color,
        icon: meta.icon,
        time: this.formatTime(n.createdAt)
      };
    });

    if (currentFilter === 'All') {
      return mapped;
    }
    return mapped.filter(n => n.category.toLowerCase() === currentFilter.toLowerCase());
  });

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  deleteNotification(id: string) {
    this.notificationService.deleteNotification(id);
  }

  onNotificationClick(n: any) {
    this.notificationService.onNotificationClick(n);
  }

  async clearAll() {
    const confirmed = await this.confirmService.ask({ 
      title: 'Clear Notifications',
      message: 'Are you sure you want to remove all notifications? This action cannot be undone.',
      confirmText: 'Clear All',
      type: 'danger'
    });

    if (confirmed) {
      this.notificationService.clearAllNotifications();
    }
  }

  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
}
