import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CommissionConfig, PlatformFeeBreakdown } from '../models/commission.model';

/**
 * CommissionService — API Client for Backend Revenue Engine
 *
 * All commission rates, calculations, and fee logic live on the backend.
 * This service is a thin HTTP client that fetches and displays results.
 *
 * Backend endpoints:
 *   GET  /api/v1/commission/config         → current commission configuration
 *   POST /api/v1/commission/calculate      → calculate fee for a specific booking
 *   GET  /api/v1/commission/rates           → category-wise rates for display
 */
@Injectable({ providedIn: 'root' })
export class CommissionService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/commission`;

  /**
   * Fetch the current commission configuration from the backend.
   * Admin can update rates via the admin dashboard; this always returns live config.
   */
  getConfig(): Observable<CommissionConfig> {
    return this.http.get<any>(`${this.base}/config`).pipe(
      map(res => res.data || res),
      catchError(() => of({
        defaultRate: 0.10,
        categoryRates: {},
        minFee: 500,
        maxFee: 75000,
        gstOnCommission: 0.18,
        tdsRate: 0.01,
      } as CommissionConfig))
    );
  }

  /**
   * Request the backend to calculate the platform fee breakdown for a booking.
   * The backend owns all rate logic, caps, subscription discounts, and TDS rules.
   *
   * @param bookingAmount Total booking value
   * @param eventCategory Event category key (e.g. 'wedding')
   * @param vendorId Vendor ID (backend uses this to apply subscription discounts)
   */
  calculateFee(bookingAmount: number, eventCategory: string, vendorId?: string): Observable<PlatformFeeBreakdown> {
    return this.http.post<any>(`${this.base}/calculate`, {
      bookingAmount,
      eventCategory,
      vendorId,
    }).pipe(
      map(res => res.data || res),
      catchError(() => {
        // Graceful degradation: show estimated breakdown if backend is unreachable
        // This is ONLY for UI display — actual fee is always computed server-side at booking creation
        const rate = 0.10;
        const commission = Math.round(bookingAmount * rate);
        const tds = Math.round(bookingAmount * 0.01);
        return of({
          bookingAmount,
          eventCategory,
          commissionRate: rate,
          commissionAmount: commission,
          gstOnCommission: Math.round(commission * 0.18),
          tdsDeduction: tds,
          vendorPayout: bookingAmount - commission - tds,
          platformRevenue: commission - Math.round(commission * 0.18),
        } as PlatformFeeBreakdown);
      })
    );
  }

  /**
   * Fetch category-wise commission rates for display purposes.
   * Actual rates applied at booking time are always from the backend.
   */
  getCategoryRates(): Observable<Record<string, number>> {
    return this.http.get<any>(`${this.base}/rates`).pipe(
      map(res => res.data || res),
      catchError(() => of({}))
    );
  }

  /** Format a rate as percentage string (display helper only) */
  formatRate(rate: number): string {
    return `${(rate * 100).toFixed(0)}%`;
  }
}
