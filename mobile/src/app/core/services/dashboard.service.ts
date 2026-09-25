import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { BookingService } from './booking.service';
import { Booking } from '../models/booking.model';
import { CustomerProfile } from '../models/user.model';
import { EventType } from '../models/event.model';
import { EventRfp } from '../models/rfp.model';

export interface CustomerDashboard {
  profile: CustomerProfile | null;
  bookings: Booking[];
  categories: EventType[];
  rfps: EventRfp[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService extends BaseApiService {
  private bookingsApi = inject(BookingService);

  /**
   * One call per card, fanned out in parallel and joined. Each leg degrades to
   * an empty value on failure so one slow or broken endpoint cannot blank the
   * whole dashboard.
   */
  getCustomerDashboard(): Observable<CustomerDashboard> {
    return forkJoin({
      profile: this.get<unknown>(API_ROUTES.PROFILE.BASE).pipe(
        map(res => this.single<CustomerProfile>(res)),
        catchError(() => of(null))
      ),
      // The bookings screen's mapping: /bookings is paged ({ items, … }), which this used to miss,
      // so the dashboard always showed no bookings.
      bookings: this.bookingsApi.getMyBookings().pipe(catchError(() => of([] as Booking[]))),
      categories: this.get<unknown>(API_ROUTES.EVENT_CATEGORIES).pipe(
        map(res =>
          this.unwrap(res).map(c => ({
            id: String(c['categoryKey'] ?? c['id'] ?? ''),
            name: String(c['name'] ?? ''),
            description: String(c['description'] ?? ''),
            icon: String(c['icon'] ?? ''),
            category: String(c['categoryKey'] ?? ''),
            gradient: (c['gradient'] as string | null) || undefined,
            startingPrice: Number(c['startingPrice'] ?? 0)
          }))
        ),
        catchError(() => of([] as EventType[]))
      ),
      rfps: this.listOf<EventRfp>(API_ROUTES.RFPS.MY)
    });
  }

  private listOf<T>(url: string): Observable<T[]> {
    return this.get<unknown>(url).pipe(
      map(res => this.unwrap(res) as unknown as T[]),
      catchError(() => of([] as T[]))
    );
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[]; items?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? payload?.items ?? []) as Record<string, unknown>[]);
  }

  private single<T>(res: unknown): T | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as T) ?? null;
  }
}
