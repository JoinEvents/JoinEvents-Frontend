import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PackageService } from '../../core/services/package.service';
import { SearchService } from '../../core/services/search.service';
import { EventPackage } from '../../core/models/event.model';

import { FavoritesService } from '../../core/services/favorites.service';

@Component({
  selector: 'app-customer-packages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './packages.html',
  styleUrl: './packages.css'
})
export class CustomerPackages implements OnInit {
  private packageService = inject(PackageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public search = inject(SearchService);
  public favoritesService = inject(FavoritesService);

  packages = signal<EventPackage[]>([]);
  selectedEvent = signal('wedding');
  vendorId = signal<string | null>(null);

  // Filter form bindings
  queryVal = signal('');
  minPriceVal = signal<number | null>(null);
  maxPriceVal = signal<number | null>(null);
  locationVal = signal('');
  minRatingVal = signal<number | null>(null);

  readonly eventOptions = [
    { id: 'wedding', label: '💍 Wedding' },
    { id: 'birthday', label: '🎂 Birthday' },
    { id: 'corporate', label: '💼 Corporate' },
    { id: 'religious', label: '🔥 Religious' },
  ];

  filteredPackages = computed(() => {
    let result = this.packages().filter(p => p.eventTypeId === this.selectedEvent());
    return this.search.filterPackages(result);
  });

  activeFiltersCount = computed(() => {
    const f = this.search.filters();
    let count = 0;
    if (f.query) count++;
    if (f.minPrice !== undefined) count++;
    if (f.maxPrice !== undefined) count++;
    if (f.location) count++;
    if (f.minRating !== undefined) count++;
    return count;
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['eventTypeId']) this.selectedEvent.set(params['eventTypeId']);
      if (params['vendorId']) this.vendorId.set(params['vendorId']);
      
      this.packageService.getPackages(params['eventTypeId']).subscribe(p => {
        this.packages.set(p);
      });
    });

    // Sync search service category with selectedEvent
    this.search.updateFilters({ category: this.selectedEvent() });
  }

  selectEvent(id: string) {
    this.selectedEvent.set(id);
    this.search.updateFilters({ category: id });
  }

  applyActiveFilters() {
    this.search.updateFilters({
      query: this.queryVal() || undefined,
      minPrice: this.minPriceVal() !== null ? Number(this.minPriceVal()) : undefined,
      maxPrice: this.maxPriceVal() !== null ? Number(this.maxPriceVal()) : undefined,
      location: this.locationVal() || undefined,
      minRating: this.minRatingVal() !== null ? Number(this.minRatingVal()) : undefined
    });
  }

  clearAllFilters() {
    // 300ms transition to restore unfiltered
    setTimeout(() => {
      this.queryVal.set('');
      this.minPriceVal.set(null);
      this.maxPriceVal.set(null);
      this.locationVal.set('');
      this.minRatingVal.set(null);
      this.search.clearFilters();
      this.search.updateFilters({ category: this.selectedEvent() });
    }, 300);
  }

  bookPackage(pkg: EventPackage) {
    this.router.navigate(['/book', pkg.id]);
  }

  getTierGradient(tier: string) {
    return tier === 'basic' ? 'linear-gradient(135deg,#94A3B8,#64748B)' : tier === 'standard' ? 'var(--gradient-primary)' : 'var(--gradient-secondary)';
  }

  getTierLabel(tier: string) { return tier === 'basic' ? 'Silver' : tier === 'standard' ? 'Gold ⭐ Most Popular' : 'Diamond 💎 Premium'; }

  isFavorite(id: string): boolean {
    return this.favoritesService.isFavorite(id);
  }

  toggleFavorite(event: Event, pkg: any) {
    event.stopPropagation();
    this.favoritesService.toggleFavorite({
      id: pkg.id,
      name: pkg.name,
      type: 'package',
      subtitle: `${pkg.tier} • ₹${pkg.price.toLocaleString('en-IN')}`,
      routeUrl: `/book/${pkg.id}`
    });
  }
}
