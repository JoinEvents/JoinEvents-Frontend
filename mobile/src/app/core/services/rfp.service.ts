import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { EventRfp, RfpBid } from '../models/rfp.model';

/**
 * Quote requests ("RFPs"). Customers raise them, vendors bid on the open
 * board, and the customer accepts a bid which converts it into a booking.
 */
@Injectable({ providedIn: 'root' })
export class RfpService extends BaseApiService {
  getMyRfps(): Observable<EventRfp[]> {
    return this.list(API_ROUTES.RFPS.MY);
  }

  /** The vendor-facing quote board. */
  getOpenRfps(): Observable<EventRfp[]> {
    return this.list(API_ROUTES.QUOTES.OPEN);
  }

  getById(id: string): Observable<EventRfp | null> {
    return this.get<unknown>(API_ROUTES.QUOTES.BY_ID(id), undefined, false).pipe(
      map(res => this.single<EventRfp>(res)),
      catchError(() => of(null))
    );
  }

  create(rfp: Partial<EventRfp>): Observable<EventRfp | null> {
    return this.post<unknown>(API_ROUTES.QUOTES.BASE, rfp, false).pipe(
      map(res => this.single<EventRfp>(res)),
      catchError(() => of(null))
    );
  }

  update(id: string, rfp: Partial<EventRfp>): Observable<EventRfp | null> {
    return this.put<unknown>(API_ROUTES.QUOTES.BY_ID(id), rfp, false).pipe(
      map(res => this.single<EventRfp>(res)),
      catchError(() => of(null))
    );
  }

  remove(id: string): Observable<boolean> {
    return this.ok(this.delete<unknown>(API_ROUTES.QUOTES.BY_ID(id), false));
  }

  submitBid(rfpId: string, bid: Partial<RfpBid>): Observable<RfpBid | null> {
    return this.post<unknown>(API_ROUTES.QUOTES.OFFERS(rfpId), bid, false).pipe(
      map(res => this.single<RfpBid>(res)),
      catchError(() => of(null))
    );
  }

  acceptBid(rfpId: string, bidId: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.QUOTES.ACCEPT_OFFER(rfpId, bidId), {}, false));
  }

  // ---- internals -------------------------------------------------------

  private list(url: string): Observable<EventRfp[]> {
    return this.get<unknown>(url, undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as EventRfp[]),
      catchError(() => of([] as EventRfp[]))
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

  private single<T>(res: unknown): T | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as T) ?? null;
  }
}
