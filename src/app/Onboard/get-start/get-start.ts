import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { EventCategoryService } from '../../core/services/event-category.service';
import { PackageService } from '../../core/services/package.service';
import { AuthService } from '../../core/services/auth.service';
import { EventTierService } from '../../core/services/event-tier.service';
import { EventType } from '../../core/models/event.model';

import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-get-start',
  standalone: true,
  imports: [RouterLink, FormsModule, TitleCasePipe],
  templateUrl: './get-start.html',
  styleUrl: './get-start.css'
})
export class GetStart implements OnInit, OnDestroy {
  private eventCategoryService = inject(EventCategoryService);
  private packageService = inject(PackageService);
  private auth = inject(AuthService);
  private router = inject(Router);
  public theme = inject(ThemeService);
  public eventTierService = inject(EventTierService);

  private slideTimer?: ReturnType<typeof setInterval>;

  eventTypes = signal<EventType[]>([]);
  eventTypesLoading = signal(true);
  currentSlide = signal(0);
  searchQuery = signal('');
  packagesLoading = signal(true);

  readonly quickCategories = [
    { id: 'wedding', name: 'Weddings', icon: 'bi-hearts', color: '#FF6B35' },
    { id: 'birthday', name: 'Birthdays', icon: 'bi-balloon-heart', color: '#6B21A8' },
    { id: 'corporate', name: 'Corporate', icon: 'bi-briefcase', color: '#0EA5E9' },
    { id: 'beauty', name: 'Beauty', icon: 'bi-brush', color: '#D946EF' },
    { id: 'travel', name: 'Travel', icon: 'bi-car-front-fill', color: '#10B981' },
    { id: 'shopping', name: 'Shopping', icon: 'bi-bag-heart-fill', color: '#F59E0B' }
  ];

  readonly trustStats = [
    { icon: 'bi-shield-check', value: '500+', label: 'Verified Vendors', bg: 'rgba(255,107,53,0.1)', color: '#FF6B35' },
    { icon: 'bi-calendar2-heart', value: '10,000+', label: 'Events Delivered', bg: 'rgba(217,70,239,0.1)', color: '#D946EF' },
    { icon: 'bi-star-fill', value: '4.8/5', label: 'Average Rating', bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' },
    { icon: 'bi-geo-alt-fill', value: '25+', label: 'Cities Covered', bg: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }
  ];

  readonly howItWorks = [
    { icon: 'bi-search', title: 'Discover', desc: 'Browse verified venues, vendors and curated packages tailored to your event.' },
    { icon: 'bi-calendar2-check', title: 'Book', desc: 'Lock in your date instantly with transparent pricing and secure advance payment.' },
    { icon: 'bi-stars', title: 'Celebrate', desc: 'Sit back while our partners and support team bring your event to life.' }
  ];

  private readonly fallbackPackages = [
    {
      id: 'pkg1', name: 'The Diamond Wedding Package', tier: 'premium', price: 5600000, rating: 4.9, totalReviews: 128,
      maxGuests: 500, roomCount: 50, vegOnly: false, location: 'Jaipur', vendorName: 'DreamCraft Weddings',
      services: ['Premium Venue', 'Gourmet Catering', 'Elegant Stage Decor'],
      image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 'pkg2', name: 'Royal Heritage Celebration', tier: 'elite', price: 3500000, rating: 4.8, totalReviews: 94,
      maxGuests: 300, roomCount: 30, vegOnly: true, location: 'Goa', vendorName: 'Elite Occasions',
      services: ['Beach Pavilion', 'Live Music & DJ', 'Photography & Videography'],
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 'pkg3', name: 'Corporate Summit Experience', tier: 'standard', price: 1200000, rating: 4.7, totalReviews: 61,
      maxGuests: 250, roomCount: 0, vegOnly: false, location: 'Bangalore', vendorName: 'Signature Events',
      services: ['Conference Hall', 'AV & Projector Setup', 'Premium Buffet Catering'],
      image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800'
    }
  ];

  trendingPackages = signal<any[]>(this.fallbackPackages);

  filteredTrendingPackages = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.trendingPackages();
    return this.trendingPackages().filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q) ||
      p.vendorName?.toLowerCase().includes(q)
    );
  });

  readonly heroSlides = [
    { title: 'Plan Your Dream Wedding', bg: 'linear-gradient(135deg,#1E293B 0%,#6B21A8 50%,#E91E8C 100%)' },
    { title: 'Corporate Events That Impress', bg: 'linear-gradient(135deg,#0F172A 0%,#0EA5E9 60%,#6B21A8 100%)' },
    { title: 'Sacred Rituals, Flawlessly Done', bg: 'linear-gradient(135deg,#1E293B 0%,#D97706 50%,#FF6B35 100%)' },
  ];

  onSearch() {
    const q = this.searchQuery().trim();
    if (q) {
      this.router.navigate(['/events'], { queryParams: { q } });
    } else {
      this.router.navigate(['/events']);
    }
  }

  formatPriceLakh(price: number): string {
    if (!price) return '₹0';
    const lakh = price / 100000;
    if (lakh >= 1) {
      return '₹' + (lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)) + 'L';
    }
    return '₹' + (price / 1000).toFixed(0) + 'k';
  }

  goToCategory(category: string) {
    this.router.navigate(['/events'], { queryParams: { category } });
  }

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      const role = this.auth.getRole();
      const path = role === 'customer' ? '/dashboard' : `/${role}/dashboard`;
      this.router.navigate([path]);
      return;
    }

    this.eventCategoryService.getAll().subscribe({
      next: types => {
        this.eventTypes.set(types);
        this.eventTypesLoading.set(false);
      },
      error: () => this.eventTypesLoading.set(false)
    });

    this.packageService.getPackages().subscribe({
      next: (packages) => {
        if (packages && packages.length > 0) {
          this.trendingPackages.set(packages.slice(0, 6));
        }
        this.packagesLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load packages for get-started page:', err);
        this.packagesLoading.set(false);
      }
    });

    this.slideTimer = setInterval(() => {
      this.currentSlide.update(s => (s + 1) % this.heroSlides.length);
    }, 4500);
  }

  ngOnDestroy() {
    if (this.slideTimer) clearInterval(this.slideTimer);
  }

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    if (img.nextElementSibling) {
      (img.nextElementSibling as HTMLElement).style.display = 'block';
    }
  }
}
