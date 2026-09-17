import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { LoyaltyTransaction } from '../models/user.model';

export interface LoyaltyBalance {
  points: number;
  tier: 'Bronze' | 'Silver' | 'Gold';
  pointsToNextTier: number;
  nextTier?: string;
  lifetimePoints: number;
  referralCode?: string;
}

@Injectable({ providedIn: 'root' })
export class LoyaltyService extends BaseApiService {
  getBalance(userId: string): Observable<LoyaltyBalance | null> {
    return this.get<unknown>(API_ROUTES.LOYALTY.BALANCE, { userId: this.cleanGuid(userId) }, false).pipe(
      map(res => this.single<LoyaltyBalance>(res)),
      catchError(() => of(null))
    );
  }

  getHistory(userId: string): Observable<LoyaltyTransaction[]> {
    return this.get<unknown>(API_ROUTES.LOYALTY.HISTORY, { userId: this.cleanGuid(userId) }, false).pipe(
      map(res => this.unwrap(res) as unknown as LoyaltyTransaction[]),
      catchError(() => of([] as LoyaltyTransaction[]))
    );
  }

  redeem(userId: string, points: number, bookingId?: string): Observable<boolean> {
    return this.ok(
      this.post<unknown>(API_ROUTES.LOYALTY.REDEEM, { userId: this.cleanGuid(userId), pointsToRedeem: points, bookingId }, false)
    );
  }

  calculateDiscount(userId: string, pointsToRedeem: number): Observable<{ discountAmount: number } | null> {
    return this.post<{ discountAmount: number }>(
      API_ROUTES.LOYALTY.CALCULATE_DISCOUNT,
      { userId: this.cleanGuid(userId), pointsToRedeem },
      false
    ).pipe(catchError(() => of(null)));
  }

  referFriend(userId: string, friendEmail: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.LOYALTY.REFER, { userId: this.cleanGuid(userId), friendEmail }, false));
  }

  claimReviewBonus(userId: string, bookingId: string): Observable<boolean> {
    return this.ok(
      this.post<unknown>(API_ROUTES.LOYALTY.REVIEW, { userId: this.cleanGuid(userId), bookingId: this.cleanGuid(bookingId) }, false)
    );
  }

  /** The API rejects braced GUIDs, which some payloads still carry. */
  private cleanGuid(value: string): string {
    return (value ?? '').replace(/[{}]/g, '');
  }

  private ok(source: Observable<unknown>): Observable<boolean> {
    return source.pipe(map(() => true), catchError(() => of(false)));
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? []) as Record<string, unknown>[]);
  }

  private single<T>(res: unknown): T | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as T) ?? null;
  }
}
