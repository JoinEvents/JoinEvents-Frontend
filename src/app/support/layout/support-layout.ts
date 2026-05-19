import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-support-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './support-layout.html',
  styleUrl: './support-layout.css'
})
export class SupportLayout {
  private auth = inject(AuthService);
  private api = inject(MockApiService);
  public theme = inject(ThemeService);
  user = this.auth.currentUser;
  sidebarOpen = signal(false);
  showNotifications = signal(false);
  showProfileDropdown = signal(false);
  notifications = signal<any[]>([]);

  constructor() {
    this.api.getNotifications().subscribe(data => this.notifications.set(data));
  }

  readonly navItems = [
    { path: '/support/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
    { path: '/support/tickets', icon: 'bi-headset', label: 'Active Tickets', badge: 8 },
    { path: '/support/verifications', icon: 'bi-shield-check', label: 'Verification Portal', badge: 3 },
    { path: '/support/bookings', icon: 'bi-calendar3', label: 'Booking Monitor' },
    { path: '/support/customers', icon: 'bi-people', label: 'Customer Directory' },
    { path: '/support/vendors', icon: 'bi-shop', label: 'Vendor Directory' },
    { path: '/support/reviews', icon: 'bi-chat-left-dots', label: 'Review Disputes', badge: 1 },
  ].map(i => ({ badge: undefined, ...i }));

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
}
