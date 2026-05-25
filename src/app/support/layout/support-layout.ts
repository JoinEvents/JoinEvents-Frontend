import { Component, signal, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';
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
  private api = inject(MockApiService);
  public theme = inject(ThemeService);
  private supportService = inject(SupportService);
  
  user = this.auth.currentUser;
  sidebarOpen = signal(false);
  sidebarPinned = signal(false);
  showNotifications = signal(false);
  showProfileDropdown = signal(false);
  notifications = signal<any[]>([]);

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
    this.api.getNotifications().subscribe(data => this.notifications.set(data));
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
