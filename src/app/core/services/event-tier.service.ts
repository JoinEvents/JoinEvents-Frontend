import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface TierInfo {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  description?: string;
  icon?: string;
  gradient?: string;
  priceRanges?: any[];
}

@Injectable({ providedIn: 'root' })
export class EventTierService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tiers`;

  // Reactive state holding the loaded public active tiers
  tiers = signal<TierInfo[]>([]);
  private loaded = false;

  /**
   * Fetch all active pricing tiers
   */
  loadAll(): Observable<TierInfo[]> {
    return this.http
      .get<ApiResponse<TierInfo[]>>(this.base)
      .pipe(
        map(res => {
          this.tiers.set(res.data || []);
          this.loaded = true;
          return res.data;
        })
      );
  }

  /**
   * Safe, cached dynamic lookup that retrieves the Bootstrap icon for a given tier name.
   * If not loaded yet, lazily initiates a background fetch.
   */
  getIconForTier(tierName?: string): string {
    if (!tierName) {
      return 'bi-gem'; // Fallback default icon
    }
    if (!this.loaded) {
      this.loadAll().subscribe();
    }
    const match = this.tiers().find(t => t.name.toLowerCase() === tierName.trim().toLowerCase());
    return match?.icon || 'bi-gem'; // Matches the configured dynamic icon, fallback to bi-gem
  }

  /**
   * Safe, cached dynamic lookup that retrieves the CSS linear gradient background for a given tier name.
   * If not loaded yet, lazily initiates a background fetch.
   */
  getGradientForTier(tierName?: string): string {
    if (!tierName) {
      return 'linear-gradient(135deg,#6B7280,#374151)'; // Default gray fallback gradient
    }
    if (!this.loaded) {
      this.loadAll().subscribe();
    }
    const match = this.tiers().find(t => t.name.toLowerCase() === tierName.trim().toLowerCase());
    return match?.gradient || 'linear-gradient(135deg,#6B7280,#374151)';
  }
}
