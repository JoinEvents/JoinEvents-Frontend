import { Component, signal, computed, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb';
import { SupportService } from '../../core/services/support.service';

@Component({
  selector: 'app-support-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, BreadcrumbComponent],
  templateUrl: './support-layout.html',
  styleUrl: './support-layout.css'
})
export class SupportLayout implements OnInit {
  private auth = inject(AuthService);
  private notificationService = inject(NotificationService);
  public theme = inject(ThemeService);
  private supportService = inject(SupportService);
  
  user = this.auth.currentUser;
  sidebarOpen = signal(false);
  sidebarPinned = signal(false);
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

  notifications = computed(() => {
    return this.notificationService.activeNotifications().map(n => {
      const meta = this.getTypeMeta(n.type);
      return {
        ...n,
        color: meta.color,
        icon: meta.icon,
        time: this.formatTime(n.createdAt)
      };
    });
  });

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    if (this.showProfileDropdown() && !target.closest('.position-relative:has(.topbar-avatar)')) {
      this.showProfileDropdown.set(false);
    }
    
    if (this.showNotifications() && !target.closest('.position-relative:has(i.bi-bell)')) {
      this.showNotifications.set(false);
    }
  }

  private checkScreenSize() {
    if (window.innerWidth < 1200) {
      this.sidebarPinned.set(false);
    }
  }

  togglePin() {
    this.sidebarPinned.update(v => !v);
  }

  navItems = [
    { path: '/support/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
    { path: '/support/tickets', icon: 'bi-headset', label: 'Active Tickets', badge: undefined as number | undefined },
    { path: '/support/verifications', icon: 'bi-shield-check', label: 'Verification Portal', badge: undefined as number | undefined },
    { path: '/support/bookings', icon: 'bi-calendar3', label: 'Booking Monitor' },
    { path: '/support/customers', icon: 'bi-people', label: 'Customer Directory' },
    { path: '/support/vendors', icon: 'bi-shop', label: 'Vendor Directory' },
    { path: '/support/reviews', icon: 'bi-chat-left-dots', label: 'Review Disputes', badge: undefined as number | undefined },
  ].map(i => ({ badge: undefined, ...i }));

  constructor() {
    this.checkScreenSize();
  }

  ngOnInit() {
    this.supportService.getDashboardStats().subscribe(stats => {
      if (stats) {
        const open = stats.openTickets ?? stats.OpenTickets ?? 0;
        const pending = stats.pendingReviews ?? stats.PendingReviews ?? 0;

        const t = this.navItems.find(i => i.path === '/support/tickets');
        if (t) t.badge = open > 0 ? open : undefined;

        const v = this.navItems.find(i => i.path === '/support/verifications');
        if (v) v.badge = pending > 0 ? pending : undefined;
      }
    });
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
  getInitials(name: string) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'S'; }

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
    if (diffX < -60) {
      this.sidebarOpen.set(false);
    }
  }
}
