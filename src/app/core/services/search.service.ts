import { Injectable, signal } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { VendorService } from '../models/service.model';

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

    const parts = f.availableDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    const checks = firstFiltered.map(s => {
      // Generate mock calendar inline for availability checks
      const daysInMonth = new Date(year, month, 0).getDate();
      const bookedDays = [3, 7, 12, 18, 24, 28];
      const blockedDays = [1, 15];
      const calendar = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let status = 'available';
        if (bookedDays.includes(d)) status = 'booked';
        else if (blockedDays.includes(d)) status = 'blocked';
        calendar.push({ date: dateStr, status });
      }

      const matchedDay = calendar.find(d => d.date === f.availableDate);
      const isUnavailable = matchedDay && (matchedDay.status === 'booked' || matchedDay.status === 'blocked');
      return of({ service: s, keep: !isUnavailable });
    });

    if (checks.length === 0) {
      return of([]);
    }

    return forkJoin(checks).pipe(
      map(results => results.filter(r => r.keep).map(r => r.service))
    );
  }
}
