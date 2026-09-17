import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';

export interface Review {
  id: string;
  bookingId: string;
  vendorId: string;
  customerName: string;
  customerAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
  isFlagged?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReviewService extends BaseApiService {
  submit(review: { bookingId: string; vendorId: string; rating: number; comment: string }): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.REVIEWS.BASE, review, false));
  }

  flag(reviewId: string, reason: string): Observable<boolean> {
    return this.ok(this.post<unknown>(`${API_ROUTES.REVIEWS.BASE}/${reviewId}/flag`, { reason }, false));
  }

  getByVendor(vendorId: string): Observable<Review[]> {
    return this.get<unknown>(`${API_ROUTES.REVIEWS.BASE}/vendor/${vendorId}`, undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as Review[]),
      catchError(() => of([] as Review[]))
    );
  }

  private ok(source: Observable<unknown>): Observable<boolean> {
    return source.pipe(map(() => true), catchError(() => of(false)));
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? []) as Record<string, unknown>[]);
  }
}
