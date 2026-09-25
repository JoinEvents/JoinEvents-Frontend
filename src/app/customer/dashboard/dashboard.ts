import { Component, signal, computed, OnInit, OnDestroy, inject, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { MessengerService } from '../../core/services/messenger.service';
import { LoyaltyService } from '../../core/services/loyalty.service';
import { PackageService } from '../../core/services/package.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { EventTierService } from '../../core/services/event-tier.service';
import { AiService } from '../../core/services/ai.service';
import { EventType } from '../../core/models/event.model';
import { Booking } from '../../core/models/booking.model';
import { ChatThread } from '../../core/models/message.model';
import { ToastService } from '../../core/services/toast.service';
import { catchError, of } from 'rxjs';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-customer-dashboard',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerDashboard implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private messenger = inject(MessengerService);
  private loyaltyService = inject(LoyaltyService);
  private packageService = inject(PackageService);
  public favoritesService = inject(FavoritesService);
  private toast = inject(ToastService);
  private router = inject(Router);
  public eventTierService = inject(EventTierService);
  private aiService = inject(AiService);

  user = this.auth.currentUser;
  loading = signal<boolean>(false);
  
  // Asynchronous Loading Signals
  bookingsLoading = signal<boolean>(true);
  eventTypesLoading = signal<boolean>(true);
  loyaltyLoading = signal<boolean>(true);
  messagesLoading = signal<boolean>(true);
  packagesLoading = signal<boolean>(true);

  eventTypes = signal<EventType[]>([]);
  bookings = signal<Booking[]>([]);
  customerProfile = signal<any>(null);
  loyaltyBalance = signal<any>(null);
  recentMessages = signal<ChatThread[]>([]);

  // Redesign Signals
  selectedCity = signal<string>('Delhi NCR');
  searchQuery = signal<string>('');
  allPackages = signal<any[]>([]);
  trendingPackages = signal<any[]>([]);
  popularPackages = signal<any[]>([]);
  activeCampaignIndex = signal<number>(0);
  activeCardCarouselIndex = signal<Record<string, number>>({});
  isLocationDropdownOpen = signal<boolean>(false);

  /** Set once the profile or the user has picked a city, so listings no longer choose it. */
  private cityChosen = false;
  private campaignTimer: any;
  private hoverTimers: Record<string, any> = {};

  private isMouseDown = false;
  private startX = 0;
  private scrollLeftStart = 0;
  private dragMoved = false;

  readonly cities = [
    'Delhi NCR',
    'Mumbai',
    'Bengaluru',
    'Hyderabad',
    'Pune',
    'Gurugram',
    'Noida',
    'Chennai',
    'Kolkata'
  ];

  readonly campaigns = [
    {
      title: 'Plan Your Dream Event',
      subtitle: 'Ask Roshi, your AI event concierge, to find packages for your budget, check your bookings and explain refunds.',
      btnText: 'Ask Roshi',
      btnRoute: 'roshi',
      icon: 'bi-stars',
      badge: 'Smart Tool',
      gradient: 'linear-gradient(135deg, #FF6B35 0%, #D946EF 100%)'
    },
    {
      title: 'Get Custom Vendor Bids',
      subtitle: 'Describe your event once and compare quotes from verified vendors.',
      btnText: 'Create RFP Request',
      btnRoute: '/get-quotes',
      icon: 'bi-file-earmark-text-fill',
      badge: 'Save Money',
      gradient: 'linear-gradient(135deg, #6B21A8 0%, #9333EA 100%)'
    },
    {
      title: 'JoinEvents Loyalty Rewards',
      subtitle: 'Earn points on every booking and unlock free decorations, premium catering, and sound setups.',
      btnText: 'Explore Rewards',
      btnRoute: '/rewards',
      icon: 'bi-gem',
      badge: 'Loyalty Club',
      gradient: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)'
    }
  ];

  /** Vendors behind the listed packages, best rated first. */
  readonly featuredVendors = computed(() => {
    const byVendor = new Map<string, { name: string; category: string; city: string; rating: number; reviews: number; packages: number }>();
    for (const p of this.allPackages()) {
      const name = p.vendorName;
      if (!name || name === 'JoinEvents Partner') continue;
      const v = byVendor.get(name) ?? { name, category: this.getEventTypeName(p.category), city: p.location || '', rating: 0, reviews: 0, packages: 0 };
      v.packages++;
      if ((p.rating || 0) > v.rating) v.rating = p.rating || 0;
      v.reviews += p.totalReviews || 0;
      byVendor.set(name, v);
    }
    return [...byVendor.values()]
      .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews || b.packages - a.packages)
      .slice(0, 4)
      .map(v => ({ ...v, avatar: v.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() }));
  });

  /** The lowest listed package price per category, so a category card never reads "From ₹0k". */
  readonly categoryFrom = computed(() => {
    const from: Record<string, number> = {};
    for (const p of this.allPackages()) {
      const key = String(p.category || '').toLowerCase();
      if (p.price > 0 && (!from[key] || p.price < from[key])) from[key] = p.price;
    }
    return from;
  });

  /** True when nothing is listed in the chosen city and other cities' packages are shown instead. */
  readonly popularIsFallback = signal(false);

  /** Bookings still ahead of the customer: not cancelled, rejected or finished; soonest first. */
  readonly upcomingBookings = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return this.bookings()
      .filter(b => !['cancelled', 'rejected', 'completed', 'settled'].includes(b.status))
      .filter(b => new Date(b.eventDate).getTime() >= today.getTime())
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  });

  readonly stats = signal([
    { label: 'Upcoming Events', value: '0', icon: 'bi-calendar-event', gradient: 'linear-gradient(135deg,#FF6B35,#F59E0B)', iconBg: 'rgba(255,107,53,0.12)', iconColor: 'var(--primary)', route: '/bookings' },
    { label: 'Active Bookings', value: '0', icon: 'bi-journal-check', gradient: 'linear-gradient(135deg,#6B21A8,#9333EA)', iconBg: 'rgba(107,33,168,0.12)', iconColor: 'var(--secondary)', route: '/bookings' },
    { label: 'Quote Requests', value: '0', icon: 'bi-chat-quote', gradient: 'linear-gradient(135deg,#16A34A,#0EA5E9)', iconBg: 'rgba(22,163,74,0.12)', iconColor: 'var(--success)', route: '/get-quotes' },
    { label: 'Loyalty Points', value: '0', icon: 'bi-star-half', gradient: 'linear-gradient(135deg,#F59E0B,#FF6B35)', iconBg: 'rgba(245,158,11,0.12)', iconColor: 'var(--accent)', route: '/rewards' },
  ]);

  ngOnInit() {
    this.loading.set(false);
    
    // Load Event Categories
    this.dashboardService.getEventCategories().subscribe({
      next: t => {
        this.eventTypes.set(t);
        this.eventTypesLoading.set(false);
      },
      error: () => this.eventTypesLoading.set(false)
    });
    
    const user = this.auth.currentUser();
    const userId = user?.id ?? 'c1';

    // Set Default City based on User Profile City if available
    this.dashboardService.getCustomerProfile().subscribe(customer => {
      if (customer) {
        this.customerProfile.set(customer);
        if (customer.city) {
          const matchedCity = this.cities.find(c => c.toLowerCase().includes(customer.city.toLowerCase()));
          if (matchedCity) {
            this.selectedCity.set(matchedCity);
            this.cityChosen = true;
            this.filterPackages();
          }
        }
      }
    });

    // Load Bookings
    this.dashboardService.getBookings().subscribe({
      next: b => {
        this.bookings.set(b);
        const upcoming = this.upcomingBookings().length;
        // Paid for and going ahead: the vendor has the booking in hand.
        const active = b.filter(book => ['advance_paid', 'confirmed', 'in_progress'].includes(book.status)).length;
        
        this.stats.update(s => {
          const updated = [...s];
          updated[0].value = upcoming.toString();
          updated[1].value = active.toString();
          return updated;
        });
        this.bookingsLoading.set(false);
      },
      error: () => this.bookingsLoading.set(false)
    });

    // Load RFPs
    this.dashboardService.getRfps().subscribe(rfps => {
      this.stats.update(s => {
        const updated = [...s];
        updated[2].value = rfps.length.toString();
        return updated;
      });
    });

    // Load Loyalty
    if (userId && userId !== 'c1') {
      this.loyaltyService.getBalance(userId).subscribe({
        next: bal => {
          this.loyaltyBalance.set(bal);
          this.stats.update(s => {
            const updated = [...s];
            updated[3].value = bal.points.toLocaleString();
            return updated;
          });
          this.loyaltyLoading.set(false);
        },
        error: () => this.loyaltyLoading.set(false)
      });
    } else {
      this.loyaltyLoading.set(false);
    }

    // Load Chats
    this.messenger.getChatThreads(userId).pipe(
      catchError(err => {
        if (err.status !== 401) {
          console.error('Failed to load recent messages on dashboard:', err);
        }
        return of([]);
      })
    ).subscribe({
      next: threads => {
        const validThreads = (threads || []).filter(t => t && t.lastMessage);
        this.recentMessages.set(validThreads.slice(0, 3));
        const unread = validThreads.filter(t => t.unreadCount > 0).length;
        if (unread > 0) {
          this.toast.info(`You have ${unread} unread message(s) waiting!`);
        }
        this.messagesLoading.set(false);
      },
      error: () => this.messagesLoading.set(false)
    });

    // Load Packages for Trending & Popular Near You
    this.packageService.getPackages().subscribe({
      next: pkgs => {
        const mapped = pkgs.map(p => ({
          ...p,
          images: p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : []),
          activeImageIndex: 0
        }));
        this.allPackages.set(mapped);
        this.defaultCityFromListings();
        this.filterPackages();
        this.packagesLoading.set(false);
      },
      error: () => this.packagesLoading.set(false)
    });

    // Start Campaign Auto-sliding timer (every 6 seconds)
    this.campaignTimer = setInterval(() => {
      this.activeCampaignIndex.update(idx => (idx + 1) % this.campaigns.length);
    }, 6000);
  }

  ngOnDestroy() {
    if (this.campaignTimer) clearInterval(this.campaignTimer);
    Object.values(this.hoverTimers).forEach(timer => clearInterval(timer));
  }

  private checkLoadingState() {
    if (this.allPackages().length > 0 || this.bookings().length >= 0) {
      this.loading.set(false);
    }
  }

  filterPackages() {
    const pkgs = this.allPackages();
    const city = this.selectedCity().toLowerCase();

    // 1. Trending Packages: Nationwide top-rated packages
    const trending = [...pkgs]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 4);
    this.trendingPackages.set(trending);

    // 2. Popular Packages Near You: Packages in the selected city
    const popular = pkgs.filter(p => {
      const loc = (p.location || '').toLowerCase();
      // Check if location contains city string
      return !!loc && (loc.includes(city) || city.includes(loc));
    });

    // Nothing listed in this city yet: show other cities' packages, and say so.
    this.popularIsFallback.set(popular.length === 0 && pkgs.length > 0);
    this.popularPackages.set((popular.length ? popular : pkgs).slice(0, 4));
  }

  /** Without a city on the profile, start where most packages are listed rather than a fixed city. */
  private defaultCityFromListings() {
    if (this.cityChosen) return;
    const counts = new Map<string, number>();
    for (const p of this.allPackages()) {
      const loc = String(p.location || '').toLowerCase();
      const city = this.cities.find(c => loc && (loc.includes(c.toLowerCase()) || c.toLowerCase().includes(loc)));
      if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) this.selectedCity.set(best[0]);
  }

  onCityChange() {
    this.filterPackages();
  }

  toggleLocationDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.isLocationDropdownOpen.update(v => !v);
  }

  onSelectCity(event: MouseEvent, city: string) {
    event.stopPropagation();
    this.selectedCity.set(city);
    this.cityChosen = true;
    this.isLocationDropdownOpen.set(false);
    this.onCityChange();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.isLocationDropdownOpen.set(false);
  }

  onSearch() {
    const query = this.searchQuery().trim();
    if (query) {
      this.router.navigate(['/events/vendors'], { queryParams: { q: query } });
    } else {
      this.router.navigate(['/events']);
    }
  }

  toggleFavorite(event: Event, pkg: any) {
    event.stopPropagation();
    event.preventDefault();
    this.favoritesService.toggleFavorite({
      id: pkg.id,
      name: pkg.name,
      type: 'package',
      subtitle: `${pkg.location} • ₹${(pkg.price / 1000).toFixed(0)}k`,
      imageUrl: pkg.image,
      routeUrl: `/events/vendors?category=${pkg.category}&packageId=${pkg.id}`
    });
    this.toast.success(`${this.favoritesService.isFavorite(pkg.id) ? 'Added to' : 'Removed from'} favorites!`);
  }

  isFavorite(id: string): boolean {
    return this.favoritesService.isFavorite(id);
  }

  /** How far along a booking is, for the timeline bar. */
  planningProgress(status: string): number {
    const map: Record<string, number> = { pending: 25, advance_paid: 50, confirmed: 75, in_progress: 90 };
    return map[status] ?? (status === 'cancelled' || status === 'rejected' ? 0 : 100);
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = { pending: 'ee-badge-warning', advance_paid: 'ee-badge-info', confirmed: 'ee-badge-secondary', in_progress: 'ee-badge-primary', completed: 'ee-badge-success', settled: 'ee-badge-success', cancelled: 'ee-badge-danger' };
    return map[status] || 'ee-badge-primary';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = { pending: 'Pending', advance_paid: 'Advance Paid', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', settled: 'Settled', cancelled: 'Cancelled' };
    return map[status] || status;
  }

  getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  goToVendors(category: string) {
    if (this.dragMoved) {
      return;
    }
    const cleanCategory = (category || '').toLowerCase();
    this.router.navigate(['/events/vendors'], { queryParams: { [cleanCategory]: '' } });
  }

  selectCampaign(route: string) {
    if (route === 'roshi') {
      this.openRoshi();
      return;
    }
    this.router.navigateByUrl(route);
  }

  openRoshi() {
    this.aiService.open();
  }

  setCampaignIndex(idx: number) {
    this.activeCampaignIndex.set(idx);
  }

  startCardCarousel(pkgId: string, maxImages: number) {
    if (maxImages <= 1) return;
    if (this.hoverTimers[pkgId]) return;
    
    this.hoverTimers[pkgId] = setInterval(() => {
      this.activeCardCarouselIndex.update(indices => {
        const current = indices[pkgId] || 0;
        return { ...indices, [pkgId]: (current + 1) % maxImages };
      });
    }, 2000);
  }

  stopCardCarousel(pkgId: string) {
    if (this.hoverTimers[pkgId]) {
      clearInterval(this.hoverTimers[pkgId]);
      delete this.hoverTimers[pkgId];
    }
    this.activeCardCarouselIndex.update(indices => {
      const updated = { ...indices };
      delete updated[pkgId];
      return updated;
    });
  }

  getEventTypeName(category: string): string {
    if (!category) return '';
    const cat = category.toLowerCase();
    if (cat.includes('wedding') || cat.includes('shaadi')) return 'Wedding';
    if (cat.includes('birthday') || cat.includes('party')) return 'Birthday Party';
    if (cat.includes('corporate')) return 'Corporate Event';
    if (cat.includes('beauty')) return 'Beauty & Styling';
    if (cat.includes('travel')) return 'Travel & Transport';
    if (cat.includes('shopping')) return 'Event Shopping';
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  getEventTypeBadgeStyle(category: string): { [key: string]: string } {
    if (!category) return { 'background-color': 'rgba(107, 33, 168, 0.08)', 'color': '#6b21a8' };
    const cat = category.toLowerCase();
    if (cat.includes('wedding') || cat.includes('shaadi')) {
      return { 'background-color': 'rgba(233, 30, 99, 0.08)', 'color': '#e91e63' };
    }
    if (cat.includes('birthday') || cat.includes('party')) {
      return { 'background-color': 'rgba(245, 158, 11, 0.08)', 'color': '#d97706' };
    }
    if (cat.includes('corporate')) {
      return { 'background-color': 'rgba(14, 165, 233, 0.08)', 'color': '#0284c7' };
    }
    if (cat.includes('beauty')) {
      return { 'background-color': 'rgba(217, 70, 239, 0.08)', 'color': '#c026d3' };
    }
    if (cat.includes('travel')) {
      return { 'background-color': 'rgba(16, 185, 129, 0.08)', 'color': '#059669' };
    }
    if (cat.includes('shopping')) {
      return { 'background-color': 'rgba(244, 63, 94, 0.08)', 'color': '#e11d48' };
    }
    return { 'background-color': 'rgba(107, 33, 168, 0.08)', 'color': '#6b21a8' };
  }

  formatPriceLakh(price: number): string {
    if (!price) return '₹0';
    const lakh = price / 100000;
    if (lakh >= 1) {
      return '₹' + (lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)) + 'L';
    }
    return '₹' + (price / 1000).toFixed(0) + 'k';
  }

  getTierLabel(tier: string): string {
    const map: Record<string, string> = {
      'basic': 'Silver',
      'standard': 'Gold',
      'premium': 'Platinum',
      'elite': 'Elite'
    };
    return map[(tier || '').toLowerCase()] || tier?.charAt(0).toUpperCase() + tier?.slice(1) || 'Gold';
  }

  getTierColorClass(tier: string): string {
    const t = (tier || '').toLowerCase();
    if (t === 'premium' || t === 'elite') return 'tier-platinum';
    if (t === 'standard') return 'tier-gold';
    return 'tier-silver';
  }

  getServiceTags(pkg: any): string[] {
    const services = pkg.services || [];
    if (services.length === 0) {
      // Derive from category
      const cat = (pkg.category || '').toLowerCase();
      if (cat.includes('wedding')) return ['Venue', 'Catering', 'Decoration'];
      if (cat.includes('birthday')) return ['Venue', 'Catering', 'Decoration'];
      if (cat.includes('corporate')) return ['Conference', 'Catering', 'AV Setup'];
      return ['Venue', 'Catering'];
    }
    // Shorten service names and take first 3
    return services.slice(0, 3).map((s: string) => {
      // Extract last meaningful word(s)
      const words = s.split(/[\s&]+/);
      if (words.length <= 2) return s;
      return words.slice(-2).join(' ');
    });
  }

  getExtraServiceCount(pkg: any): number {
    const services = pkg.services || [];
    return Math.max(0, services.length - 3);
  }

  onWheelScroll(event: WheelEvent) {
    if (event.deltaY !== 0) {
      event.preventDefault();
      const container = event.currentTarget as HTMLElement;
      container.scrollLeft += event.deltaY;
    }
  }

  onMouseDown(event: MouseEvent) {
    this.isMouseDown = true;
    this.dragMoved = false;
    this.startX = event.pageX - (event.currentTarget as HTMLElement).offsetLeft;
    this.scrollLeftStart = (event.currentTarget as HTMLElement).scrollLeft;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isMouseDown) return;
    event.preventDefault();
    const container = event.currentTarget as HTMLElement;
    const x = event.pageX - container.offsetLeft;
    const walk = (x - this.startX) * 1.5; // multiplier for scrolling speed
    if (Math.abs(walk) > 5) {
      this.dragMoved = true;
    }
    container.scrollLeft = this.scrollLeftStart - walk;
  }

  onMouseUp() {
    this.isMouseDown = false;
    setTimeout(() => {
      this.dragMoved = false;
    }, 100);
  }

  onMouseLeave() {
    this.isMouseDown = false;
    this.dragMoved = false;
  }
}

