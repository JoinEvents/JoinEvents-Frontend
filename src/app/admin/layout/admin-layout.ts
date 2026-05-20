import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb';

export interface NavItem {
  path: string;
  icon: string;
  label: string;
  protected?: boolean;
  adminOnly?: boolean;
  badge?: number;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BreadcrumbComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout {
  private auth = inject(AuthService);
  public theme = inject(ThemeService);
  public notifService = inject(NotificationService);

  user = this.auth.currentUser;
  sidebarOpen = signal(false);
  showNotifications = signal(false);
  showProfileDropdown = signal(false);

  getTypeMeta(type: string) {
    const meta: Record<string, { color: string; icon: string }> = {
      booking: { color: '#FF6B35', icon: 'bi-calendar-check' },
      message: { color: '#3B82F6', icon: 'bi-chat-dots' },
      payment: { color: '#10B981', icon: 'bi-cash-stack' },
      verification: { color: '#8B5CF6', icon: 'bi-shield-check' },
      system: { color: '#EF4444', icon: 'bi-server' }
    };
    return meta[type] || { color: '#6366F1', icon: 'bi-bell' };
  }

  notifications = computed(() => {
    return this.notifService.activeNotifications().map(n => {
      const meta = this.getTypeMeta(n.type);
      return {
        ...n,
        color: meta.color,
        icon: meta.icon,
        time: this.formatTime(n.createdAt)
      };
    });
  });

  unreadCount = computed(() => this.notifService.unreadCount());

  readonly navItemsBase: NavItem[] = [
    { path: '/admin/dashboard',     icon: 'bi-grid-1x2',       label: 'Dashboard' },
    { path: '/admin/users',         icon: 'bi-people',         label: 'Manage Users' },
    { path: '/admin/vendors',       icon: 'bi-patch-check',    label: 'Vendor Verification' },
    { path: '/admin/categories',    icon: 'bi-tag',            label: 'Event Categories' },
    { path: '/admin/bookings',      icon: 'bi-journal-check',  label: 'Bookings' },
    { path: '/admin/disputes',      icon: 'bi-exclamation-triangle', label: 'Disputes' },
    { path: '/admin/rfp',           icon: 'bi-megaphone',      label: 'Global RFPs' },
    { path: '/admin/audit',         icon: 'bi-receipt',        label: 'Audit Trail' },
    { path: '/admin/messages',      icon: 'bi-chat-dots',      label: 'Admin Inbox' },
    { path: '/admin/support',       icon: 'bi-ticket-detailed', label: 'Support Tickets' },
    { path: '/admin/analytics',     icon: 'bi-graph-up-arrow',  label: 'Analytics' },
    { path: '/admin/notifications', icon: 'bi-bell',          label: 'Notifications' }
  ];

  get navItems(): NavItem[] {
    const role = this.auth.getRole();
    const items: NavItem[] = this.navItemsBase.map((item: NavItem) => {
      if (item.path.includes('notifications')) {
        const unread = this.unreadCount();
        return { ...item, badge: unread > 0 ? unread : undefined } as NavItem;
      }
      return item;
    });
    return items;
  }

  logout() { this.auth.logout(); }
  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  toggleNotifications() { 
    this.showNotifications.update(v => !v); 
    if (this.showNotifications()) this.showProfileDropdown.set(false);
  }
  toggleProfileDropdown() { 
    this.showProfileDropdown.update(v => !v); 
    if (this.showProfileDropdown()) this.showNotifications.set(false);
  }
  getInitials(name: string) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'A'; }

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    if (img.nextElementSibling) {
      (img.nextElementSibling as HTMLElement).style.display = 'block';
    }
  }

  touchStartX = 0;
  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.changedTouches[0].clientX;
  }
  onTouchEnd(e: TouchEvent) {
    const diffX = e.changedTouches[0].clientX - this.touchStartX;
    if (diffX > 60) {
      this.sidebarOpen.set(true);
    } else if (diffX < -60) {
      this.sidebarOpen.set(false);
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
