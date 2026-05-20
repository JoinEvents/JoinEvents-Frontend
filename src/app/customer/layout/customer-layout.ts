import { Component, signal, ChangeDetectionStrategy, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AiService } from '../../core/services/ai.service';
import { AiPlanner } from '../ai-planner/ai-planner';
import { FavoritesService } from '../../core/services/favorites.service';
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
  selector: 'app-customer-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AiPlanner, BreadcrumbComponent],
  templateUrl: './customer-layout.html',
  styleUrl: './customer-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerLayout {
  private auth = inject(AuthService);
  private router = inject(Router);
  public theme = inject(ThemeService);
  public notifService = inject(NotificationService);
  private aiService = inject(AiService);
  public favoritesService = inject(FavoritesService);

  sidebarOpen = signal(false);
  sidebarPinned = signal(false);
  showNotifications = signal(false);
  showProfileDropdown = signal(false);
  showFavorites = signal(false);
  user = this.auth.currentUser;

  constructor() {
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    // Automatically unpin if screen width is less than 1200px (standard XL breakpoint)
    if (window.innerWidth < 1200) {
      this.sidebarPinned.set(false);
    }
  }

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

  readonly navItems: NavItem[] = [
    { path: '/dashboard', icon: 'bi-grid-1x2',      label: 'Dashboard' },
    { path: '/events',    icon: 'bi-calendar-heart', label: 'Browse Events' },
    { path: '/packages',  icon: 'bi-gift',           label: 'Packages' },
    { path: '/planner',   icon: 'bi-pencil-square',  label: 'Event Planner', protected: true },
    { path: '/rfp',       icon: 'bi-megaphone',      label: 'RFP Board', badge: 0, protected: true },
    { path: '/bookings',  icon: 'bi-journal-check',  label: 'My Bookings', protected: true },
    { path: '/messages',  icon: 'bi-chat-dots',      label: 'Messages', badge: 2, protected: true },
    { path: '/payments',  icon: 'bi-credit-card',    label: 'Payments', protected: true },
    { path: '/support',   icon: 'bi-ticket-detailed', label: 'Support', protected: true },
    { path: '/notifications', icon: 'bi-bell',       label: 'Notifications', protected: true }
  ];

  get filteredNavItems(): NavItem[] {
    return this.navItems
      .filter(item => !item.protected || this.user())
      .map((item: NavItem) => {
        if (item.path.includes('notifications')) {
          const unread = this.unreadCount();
          return { ...item, badge: unread > 0 ? unread : undefined } as NavItem;
        }
        return item;
      });
  }

  favorites = computed(() => this.favoritesService.favorites());
  favoriteCount = computed(() => this.favorites().length);

  logout() { this.auth.logout(); }
  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  togglePin() { this.sidebarPinned.update(v => !v); }
  toggleAiPlanner() { this.aiService.toggle(); }
  toggleNotifications() { 
    this.showNotifications.update(v => !v); 
    if (this.showNotifications()) {
      this.showProfileDropdown.set(false);
      this.showFavorites.set(false);
    }
  }
  toggleProfileDropdown() { 
    this.showProfileDropdown.update(v => !v); 
    if (this.showProfileDropdown()) {
      this.showNotifications.set(false);
      this.showFavorites.set(false);
    }
  }
  toggleFavorites() {
    this.showFavorites.update(v => !v);
    if (this.showFavorites()) {
      this.showNotifications.set(false);
      this.showProfileDropdown.set(false);
    }
  }
  removeFavorite(event: Event, id: string) {
    event.stopPropagation();
    this.favoritesService.removeFavorite(id);
  }
  goToFavorite(fav: any) {
    this.showFavorites.set(false);
    if (fav.routeUrl) {
      this.router.navigateByUrl(fav.routeUrl);
    }
  }
  getInitials(name: string) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'U'; }

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    if (img.nextElementSibling) {
      (img.nextElementSibling as HTMLElement).style.display = 'block';
    }
  }

  touchStartX = 0;
  touchStartY = 0;
  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.changedTouches[0].clientX;
    this.touchStartY = e.changedTouches[0].clientY;
  }
  onTouchEnd(e: TouchEvent) {
    const diffX = e.changedTouches[0].clientX - this.touchStartX;
    const diffY = e.changedTouches[0].clientY - this.touchStartY;
    
    // Only trigger swipe if horizontal movement is significantly greater than vertical movement
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      if (diffX > 0) {
        this.sidebarOpen.set(true);
      } else {
        this.sidebarOpen.set(false);
      }
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
