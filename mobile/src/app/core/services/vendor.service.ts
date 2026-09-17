import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';

export interface CalendarDay {
  date: string;
  isBlocked: boolean;
  isBooked: boolean;
  reason?: string;
  bookingId?: string;
}

export interface VendorDashboardData {
  totalBookings: number;
  pendingRequests: number;
  monthlyRevenue: number;
  rating: number;
  totalReviews: number;
  activePackages: number;
  profileCompletion: number;
  verificationStatus: string;
  upcomingEvents: { id: string; name: string; date: string; customerName: string }[];
}

@Injectable({ providedIn: 'root' })
export class VendorService extends BaseApiService {
  getDashboard(): Observable<VendorDashboardData | null> {
    return this.get<unknown>(API_ROUTES.VENDOR.DASHBOARD, undefined, false).pipe(
      map(res => this.single<VendorDashboardData>(res)),
      catchError(() => of(null))
    );
  }

  getDashboardTasks(): Observable<{ id: string; title: string; description?: string; link?: string }[]> {
    return this.listOf(API_ROUTES.VENDOR.TASKS);
  }

  getAnalytics(): Observable<Record<string, unknown> | null> {
    return this.get<unknown>(API_ROUTES.VENDOR.ANALYTICS, undefined, false).pipe(
      map(res => this.single<Record<string, unknown>>(res)),
      catchError(() => of(null))
    );
  }

  // ---- verification ----------------------------------------------------

  getVerificationStatus(): Observable<Record<string, unknown> | null> {
    return this.get<unknown>(API_ROUTES.VENDOR_VERIFICATION.STATUS, { t: Date.now() }, false).pipe(
      map(res => this.single<Record<string, unknown>>(res)),
      catchError(() => of(null))
    );
  }

  uploadVerificationDocument(file: Blob, fileName: string, documentType: string): Observable<boolean> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('documentType', documentType);
    return this.ok(this.post<unknown>(API_ROUTES.VENDOR_VERIFICATION.UPLOAD, form, false));
  }

  // ---- calendar --------------------------------------------------------

  getCalendar(month?: number, year?: number): Observable<CalendarDay[]> {
    return this.get<unknown>(API_ROUTES.VENDOR_CALENDAR.BASE, { month, year }, false).pipe(
      map(res => this.unwrap(res) as unknown as CalendarDay[]),
      catchError(() => of([] as CalendarDay[]))
    );
  }

  toggleCalendarDay(date: string, reason?: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.VENDOR_CALENDAR.TOGGLE, { date, reason }, false));
  }

  bulkBlock(dates: string[], reason?: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.VENDOR_CALENDAR.BULK_BLOCK, { dates, reason }, false));
  }

  bulkRelease(dates: string[]): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.VENDOR_CALENDAR.BULK_RELEASE, { dates }, false));
  }

  checkAvailability(vendorId: string, date: string): Observable<boolean> {
    return this.get<{ available?: boolean }>(API_ROUTES.VENDOR_CALENDAR.CHECK(vendorId), { date }, false).pipe(
      map(res => Boolean(res?.available)),
      catchError(() => of(false))
    );
  }

  // ---- B2B, offers, enquiries -------------------------------------------

  getCollaborations(): Observable<Record<string, unknown>[]> {
    return this.listOf(API_ROUTES.VENDOR.COLLABORATIONS);
  }

  acceptCollaboration(id: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.VENDOR.COLLABORATION_ACCEPT(id), {}));
  }

  getEnquiries(): Observable<Record<string, unknown>[]> {
    return this.listOf(API_ROUTES.VENDOR.ENQUIRIES);
  }

  replyToEnquiry(id: string, messageType: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.VENDOR.ENQUIRY_REPLY(id), { messageType }));
  }

  getLoyaltyStatus(): Observable<Record<string, unknown> | null> {
    return this.singleOf(API_ROUTES.VENDOR.LOYALTY);
  }

  getGrowthTarget(): Observable<Record<string, unknown> | null> {
    return this.singleOf(API_ROUTES.VENDOR.GROWTH_TARGET);
  }

  getEsgImpact(): Observable<Record<string, unknown> | null> {
    return this.singleOf(API_ROUTES.VENDOR.ESG_IMPACT);
  }

  getInvoices(): Observable<Record<string, unknown>[]> {
    return this.listOf(API_ROUTES.INVOICES.VENDOR);
  }

  // ---- internals --------------------------------------------------------

  private listOf<T = Record<string, unknown>>(url: string): Observable<T[]> {
    return this.get<unknown>(url, undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as T[]),
      catchError(() => of([] as T[]))
    );
  }

  private singleOf(url: string): Observable<Record<string, unknown> | null> {
    return this.get<unknown>(url, undefined, false).pipe(
      map(res => this.single<Record<string, unknown>>(res)),
      catchError(() => of(null))
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
