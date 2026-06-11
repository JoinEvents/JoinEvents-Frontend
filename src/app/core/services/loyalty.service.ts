import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoyaltyTransaction } from '../models/user.model';
import { API_ROUTES } from '../constants/api.constants';

export interface LoyaltyBalance {
  points: number;
  tier: 'Bronze' | 'Silver' | 'Gold';
  pointsToNextTier?: number;
}

export interface RedeemRequest {
  bookingId?: string; // Optional if redeeming outside of checkout
  pointsToRedeem: number;
}

export interface RedeemResponse {
  success: boolean;
  newBalance: number;
  discountApplied: number;
}

export interface CalculateDiscountResponse {
  valid: boolean;
  discountAmount: number;
  errorMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class LoyaltyService extends BaseApiService {

  private cleanGuid(id: string): string {
    if (!id) return '';
    const hex = id.replace(/^(usr_|pkg_|bk_)/, '');
    if (hex.length === 32) {
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return id;
  }

  getBalance(userId: string): Observable<LoyaltyBalance> {
    return this.get<any>(API_ROUTES.LOYALTY.BALANCE, { userId: this.cleanGuid(userId) }).pipe(
      map(res => ({
        points: res.Points ?? res.points ?? 0,
        tier: res.Tier ?? res.tier ?? 'Bronze',
        pointsToNextTier: res.PointsToNextTier ?? res.pointsToNextTier
      }))
    );
  }

  getHistory(userId: string): Observable<LoyaltyTransaction[]> {
    return this.get<any[]>(API_ROUTES.LOYALTY.HISTORY, { userId: this.cleanGuid(userId) }).pipe(
      map(arr => arr.map(t => ({
        id: t.Id ?? t.id,
        date: t.Date ?? t.date,
        description: t.Description ?? t.description,
        points: t.Points ?? t.points,
        type: (t.Type ?? t.type ?? '').toLowerCase()
      })))
    );
  }

  redeemPoints(userId: string, req: RedeemRequest): Observable<RedeemResponse> {
    const payload = { ...req, userId: this.cleanGuid(userId) };
    if (payload.bookingId) payload.bookingId = this.cleanGuid(payload.bookingId);
    return this.post<RedeemResponse>(API_ROUTES.LOYALTY.REDEEM, payload, false);
  }

  calculateDiscount(userId: string, pointsToRedeem: number): Observable<CalculateDiscountResponse> {
    return this.post<CalculateDiscountResponse>(API_ROUTES.LOYALTY.CALCULATE_DISCOUNT, { userId: this.cleanGuid(userId), pointsToRedeem }, false);
  }

  referFriend(userId: string, friendEmail: string): Observable<any> {
    return this.post<any>(API_ROUTES.LOYALTY.REFER, { userId: this.cleanGuid(userId), friendEmail }, false);
  }

  claimReviewBonus(userId: string, bookingId: string): Observable<any> {
    return this.post<any>(API_ROUTES.LOYALTY.REVIEW, { userId: this.cleanGuid(userId), bookingId: this.cleanGuid(bookingId) }, false);
  }
}
