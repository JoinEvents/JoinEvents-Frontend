import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Booking, BookingQuote, BookingStatus, CreateBookingRequest } from '../models/booking.model';
import { ApiResult, toResult } from '../utils/result.util';

export interface CancellationBreakdown {
  cancellationFee: number;
  refundAmount: number;
  platformRetained: number;
  vendorPenalty: number;
  daysToEvent: number;
  policyLabel: string;
}

@Injectable({ providedIn: 'root' })
export class BookingService extends BaseApiService {
  getMyBookings(): Observable<Booking[]> {
    return this.list(API_ROUTES.BOOKINGS.BASE);
  }

  getVendorBookings(): Observable<Booking[]> {
    return this.list(API_ROUTES.BOOKINGS.VENDOR);
  }

  getSupportBookings(): Observable<Booking[]> {
    return this.list(API_ROUTES.ADMIN.BOOKINGS);
  }

  getById(id: string): Observable<Booking | null> {
    return this.get<unknown>(API_ROUTES.BOOKINGS.BY_ID(id), undefined, false).pipe(
      map(res => this.single(res)),
      catchError(() => of(null))
    );
  }

  /** Loads one booking, with the server's reason when it cannot. */
  fetch(id: string): Observable<ApiResult<Booking>> {
    return toResult(this.get<Booking>(API_ROUTES.BOOKINGS.BY_ID(id), undefined, false), 'Could not load this booking.');
  }

  /** The server's price for a package and guest count: exactly what a booking will charge. */
  quote(packageId: string, guestCount: number): Observable<ApiResult<BookingQuote>> {
    return toResult(
      this.post<BookingQuote>(API_ROUTES.BOOKINGS.QUOTE, { packageId, guestCount }, false),
      'Could not price this package. Please try again.'
    );
  }

  /** Creates a booking. Only what is being booked is sent; the server prices it. */
  create(request: CreateBookingRequest): Observable<ApiResult<Booking>> {
    return toResult(this.post<Booking>(API_ROUTES.BOOKINGS.CREATE, request, false), 'We could not create the booking.');
  }

  updateStatus(bookingId: string, status: BookingStatus): Observable<boolean> {
    return this.ok(this.patch<unknown>(API_ROUTES.BOOKINGS.STATUS(bookingId), { status }, false));
  }

  updateServiceStatus(bookingId: string, serviceId: string, status: string): Observable<boolean> {
    return this.ok(
      this.patch<unknown>(`${API_ROUTES.BOOKINGS.BASE}/${bookingId}/services/${serviceId}/status`, { status }, false)
    );
  }

  cancel(bookingId: string, reason: string, cancelledBy: 'customer' | 'vendor'): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.BOOKINGS.CANCEL(bookingId), { reason, cancelledBy }, false));
  }

  addDamageCharges(bookingId: string, amount: number, notes: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.BOOKINGS.DAMAGE(bookingId), { amount, notes }, false));
  }

  raiseDispute(bookingId: string, reason: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.BOOKINGS.DISPUTE(bookingId), { reason }, false));
  }

  getLogs(bookingId: string): Observable<{ date: string; message: string; actor: string }[]> {
    return this.get<unknown>(API_ROUTES.BOOKINGS.LOGS(bookingId), undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as { date: string; message: string; actor: string }[]),
      catchError(() => of([]))
    );
  }

  addLog(bookingId: string, message: string, actor: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.BOOKINGS.LOGS(bookingId), { message, actor }, false));
  }

  assign(bookingId: string, employeeName: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.ADMIN.ASSIGN_BOOKING(bookingId), { assignedTo: employeeName }, false));
  }

  /**
   * Mirrors the web app's cancellation policy so the sheet can show the refund
   * before the user commits. The backend recomputes this authoritatively on
   * cancel — this is a preview, never the source of truth.
   */
  previewCancellation(booking: Booking, cancelledBy: 'customer' | 'vendor'): CancellationBreakdown {
    const eventDate = new Date(booking.eventDate).getTime();
    const daysToEvent = Math.max(0, Math.ceil((eventDate - Date.now()) / 86_400_000));
    const paid = booking.finalPaidAmount ?? booking.advanceAmount ?? 0;

    if (cancelledBy === 'vendor') {
      // Vendor-side cancellation: the customer is made whole, the vendor is penalised.
      return {
        cancellationFee: 0,
        refundAmount: paid,
        platformRetained: 0,
        vendorPenalty: Math.round(booking.totalAmount * 0.1),
        daysToEvent,
        policyLabel: 'Vendor cancellation — full refund to customer'
      };
    }

    const rate = daysToEvent >= 30 ? 0 : daysToEvent >= 15 ? 0.25 : daysToEvent >= 7 ? 0.5 : 1;
    const cancellationFee = Math.round(paid * rate);
    return {
      cancellationFee,
      refundAmount: paid - cancellationFee,
      platformRetained: Math.round(cancellationFee * 0.2),
      vendorPenalty: 0,
      daysToEvent,
      policyLabel:
        rate === 0 ? 'Free cancellation (30+ days out)'
        : rate === 0.25 ? '25% cancellation fee (15–29 days out)'
        : rate === 0.5 ? '50% cancellation fee (7–14 days out)'
        : 'Non-refundable (under 7 days)'
    };
  }

  // ---- internals -------------------------------------------------------

  private list(url: string): Observable<Booking[]> {
    return this.get<unknown>(url, undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as Booking[]),
      catchError(() => of([] as Booking[]))
    );
  }

  private ok(source: Observable<unknown>): Observable<boolean> {
    return source.pipe(map(() => true), catchError(() => of(false)));
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[]; items?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? payload?.items ?? []) as Record<string, unknown>[]);
  }

  private single(res: unknown): Booking | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as Booking) ?? null;
  }
}
