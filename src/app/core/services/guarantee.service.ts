import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * GuaranteeService — API Client for Backend Guarantee System
 *
 * All guarantee eligibility, claim processing, refund calculations,
 * and dispute resolution are handled by the backend.
 * This service fetches policies for UI display and submits claims.
 *
 * Backend endpoints:
 *   GET  /api/v1/guarantee/policies        → guarantee policy details
 *   POST /api/v1/guarantee/claim           → submit a guarantee claim
 *   GET  /api/v1/guarantee/claims          → list claims for a user
 *   GET  /api/v1/guarantee/claim/:id       → claim status & details
 */

export interface GuaranteePolicy {
  name: string;
  description: string;
  coverageType: 'no_show' | 'quality' | 'cancellation' | 'escrow';
  refundPercentage: number;
  compensationAmount: number;
  mediationRequired: boolean;
  timelineHours: number;
}

export interface GuaranteeClaim {
  id: string;
  bookingId: string;
  customerId: string;
  vendorId: string;
  claimType: 'no_show' | 'quality' | 'cancellation';
  reason: string;
  evidence?: string[];
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resolved';
  refundAmount?: number;
  compensationAmount?: number;
  submittedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

@Injectable({ providedIn: 'root' })
export class GuaranteeService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/guarantee`;

  activeClaims = signal<GuaranteeClaim[]>([]);

  /**
   * Static guarantee highlights for checkout UI display.
   * The actual guarantee terms and enforcement are backend-managed.
   */
  getGuaranteeHighlights(): { icon: string; title: string; description: string }[] {
    return [
      {
        icon: 'bi-shield-lock-fill',
        title: 'Escrow Protected',
        description: 'Funds held securely until event completion',
      },
      {
        icon: 'bi-patch-check-fill',
        title: 'Verified Vendors',
        description: 'Every vendor verified with KYC & documents',
      },
      {
        icon: 'bi-arrow-repeat',
        title: 'No-Show Refund',
        description: 'Full refund + ₹10,000 if vendor doesn\'t show',
      },
      {
        icon: 'bi-headset',
        title: 'Dedicated Support',
        description: '24/7 support for every booked event',
      },
    ];
  }

  /** Fetch guarantee policies from backend */
  getPolicies(): Observable<GuaranteePolicy[]> {
    return this.http.get<any>(`${this.base}/policies`).pipe(
      map(res => res.data || res || []),
      catchError(() => of([
        {
          name: 'Escrow Protection',
          description: 'Payment held securely and released after event completion.',
          coverageType: 'escrow' as const,
          refundPercentage: 100,
          compensationAmount: 0,
          mediationRequired: false,
          timelineHours: 0,
        },
        {
          name: 'Vendor No-Show Protection',
          description: 'Full refund plus ₹10,000 compensation for confirmed vendor no-shows.',
          coverageType: 'no_show' as const,
          refundPercentage: 100,
          compensationAmount: 10000,
          mediationRequired: false,
          timelineHours: 48,
        },
        {
          name: 'Service Quality Guarantee',
          description: 'Up to 50% refund after mediation for significant service quality issues.',
          coverageType: 'quality' as const,
          refundPercentage: 50,
          compensationAmount: 0,
          mediationRequired: true,
          timelineHours: 168,
        },
      ]))
    );
  }

  /** Submit a guarantee claim — all processing happens on backend */
  submitClaim(
    bookingId: string,
    claimType: 'no_show' | 'quality' | 'cancellation',
    reason: string,
    evidence?: string[]
  ): Observable<GuaranteeClaim> {
    return this.http.post<any>(`${this.base}/claim`, {
      bookingId, claimType, reason, evidence,
    }).pipe(
      map(res => res.data || res),
      tap(claim => this.activeClaims.update(claims => [claim, ...claims]))
    );
  }

  /** Fetch claims for the current user */
  getClaims(): Observable<GuaranteeClaim[]> {
    return this.http.get<any>(`${this.base}/claims`).pipe(
      map(res => res.data || res || []),
      tap(claims => this.activeClaims.set(claims)),
      catchError(() => of([]))
    );
  }
}
