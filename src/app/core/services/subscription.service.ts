import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  VendorSubscription,
  SubscriptionTier,
  SubscriptionTierConfig,
  SUBSCRIPTION_TIERS,
} from '../models/subscription.model';

/**
 * SubscriptionService — API Client for Backend Subscription Management
 *
 * All subscription state, billing, tier enforcement, and listing limits
 * are managed by the backend. This service fetches and caches the current
 * vendor's subscription for UI display and route guards.
 *
 * Backend endpoints:
 *   GET    /api/v1/vendor/subscription          → current subscription
 *   POST   /api/v1/vendor/subscription/upgrade  → upgrade tier
 *   POST   /api/v1/vendor/subscription/cancel   → cancel subscription
 *   GET    /api/v1/vendor/subscription/history   → billing history
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor/subscription`;

  /** Cached subscription from last API call */
  currentSubscription = signal<VendorSubscription | null>(null);

  /** Static tier configs for UI display (pricing cards, feature comparison) */
  readonly tiers = SUBSCRIPTION_TIERS;

  /** Current tier config computed from cached subscription */
  currentTierConfig = computed<SubscriptionTierConfig>(() => {
    const sub = this.currentSubscription();
    const tier = sub?.tier || 'free';
    return this.getTierConfig(tier);
  });

  /** Get static tier config by key (for UI display only) */
  getTierConfig(tier: SubscriptionTier): SubscriptionTierConfig {
    return SUBSCRIPTION_TIERS.find(t => t.tier === tier) || SUBSCRIPTION_TIERS[0];
  }

  /**
   * Fetch the current vendor's subscription from the backend.
   * Called on vendor dashboard load.
   */
  getSubscription(): Observable<VendorSubscription> {
    return this.http.get<any>(this.base).pipe(
      map(res => res.data || res),
      tap(sub => this.currentSubscription.set(sub)),
      catchError(() => {
        // Default to free tier if backend unreachable
        const defaultSub: VendorSubscription = {
          vendorId: '',
          tier: 'free',
          priceMonthly: 0,
          priceYearly: 0,
          maxActiveListings: 3,
          featuredListings: 0,
          prioritySupport: false,
          analyticsAccess: 'basic',
          badgeType: 'none',
          commissionDiscount: 0,
          startDate: new Date().toISOString(),
          renewalDate: '',
          status: 'active',
        };
        this.currentSubscription.set(defaultSub);
        return of(defaultSub);
      })
    );
  }

  /**
   * Request a tier upgrade via the backend.
   * Backend handles payment processing, proration, and activation.
   */
  upgradeTier(tier: SubscriptionTier, billingCycle: 'monthly' | 'yearly'): Observable<VendorSubscription> {
    return this.http.post<any>(`${this.base}/upgrade`, { tier, billingCycle }).pipe(
      map(res => res.data || res),
      tap(sub => this.currentSubscription.set(sub))
    );
  }

  /**
   * Cancel the current subscription via the backend.
   * Backend handles grace periods and downgrades.
   */
  cancelSubscription(): Observable<any> {
    return this.http.post<any>(`${this.base}/cancel`, {}).pipe(
      tap(() => {
        const current = this.currentSubscription();
        if (current) {
          this.currentSubscription.set({ ...current, tier: 'free', status: 'cancelled' });
        }
      })
    );
  }

  /**
   * Fetch billing/payment history from the backend.
   */
  getBillingHistory(): Observable<any[]> {
    return this.http.get<any>(`${this.base}/history`).pipe(
      map(res => res.data || res || []),
      catchError(() => of([]))
    );
  }

  /** Check if vendor has a paid subscription (from cached state) */
  isPaidSubscriber(): boolean {
    const sub = this.currentSubscription();
    return !!sub && sub.tier !== 'free' && sub.status === 'active';
  }

  /** Get badge label for display */
  getBadgeLabel(tier: SubscriptionTier): string {
    const labels: Record<SubscriptionTier, string> = {
      free: '',
      pro: 'PRO',
      premium: 'PREMIUM PARTNER',
    };
    return labels[tier];
  }
}
