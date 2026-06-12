import { Injectable, signal, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { VendorService } from '../models/service.model';
import { VendorService as VendorApiService } from './vendor.service';

export interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  minRating?: number;
  availableDate?: string;
  query?: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private vendorApiService = inject(VendorApiService);
  filters = signal<SearchFilters>({});
  validationError = signal<string | null>(null);

  updateFilters(newFilters: Partial<SearchFilters>) {
    const current = this.filters();
    const merged = { ...current, ...newFilters };

    if (merged.minPrice !== undefined && merged.maxPrice !== undefined && merged.minPrice > merged.maxPrice) {
      this.validationError.set('Minimum price cannot be greater than maximum price.');
      return;
    }

    this.validationError.set(null);
    this.filters.set(merged);
  }

  clearFilters() {
    this.filters.set({});
    this.validationError.set(null);
  }

  filterPackages(packages: any[]): any[] {
    const f = this.filters();
    if (f.minPrice !== undefined && f.maxPrice !== undefined && f.minPrice > f.maxPrice) {
      return packages;
    }

    return packages.filter(p => {
      if (f.query) {
        const q = f.query.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      if (f.category && p.category !== f.category) return false;
      if (p.price !== undefined && f.minPrice !== undefined && p.price < f.minPrice) return false;
      if (p.price !== undefined && f.maxPrice !== undefined && p.price > f.maxPrice) return false;
      if (f.location && p.city && !p.city.toLowerCase().includes(f.location.toLowerCase())) return false;
      if (f.minRating !== undefined && p.rating !== undefined && p.rating < f.minRating) return false;

      return true;
    });
  }

  searchServices(services: VendorService[]): Observable<VendorService[]> {
    const f = this.filters();
    const firstFiltered = services.filter(s => {
      if (f.query) {
        const q = f.query.toLowerCase();
        const matchesName = s.name?.toLowerCase().includes(q);
        const matchesVendor = s.vendorName?.toLowerCase().includes(q);
        const matchesLoc = s.city?.toLowerCase().includes(q);
        const matchesCat = s.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesVendor && !matchesLoc && !matchesCat) return false;
      }

      if (f.category && s.category !== f.category) return false;
      if (s.pricePerUnit !== undefined && f.minPrice !== undefined && s.pricePerUnit < f.minPrice) return false;
      if (s.pricePerUnit !== undefined && f.maxPrice !== undefined && s.pricePerUnit > f.maxPrice) return false;
      if (f.location && !s.city?.toLowerCase().includes(f.location.toLowerCase())) return false;
      if (f.minRating !== undefined && s.rating !== undefined && s.rating < f.minRating) return false;

      return true;
    });

    if (!f.availableDate) {
      return of(firstFiltered);
    }

    const vendorIds = firstFiltered.map(s => s.vendorId).filter(id => !!id);
    if (vendorIds.length === 0) {
      return of([]);
    }

    return this.vendorApiService.checkBulkAvailability(vendorIds, f.availableDate).pipe(
      map(availabilityMap => {
        return firstFiltered.filter(s => {
          // If the bulk endpoint returned a value, use it. Otherwise, default to true.
          return availabilityMap[s.vendorId] !== false;
        });
      }),
      catchError(err => {
        console.error('Failed to check bulk availability, falling back to all available:', err);
        return of(firstFiltered);
      })
    );
  }
}
