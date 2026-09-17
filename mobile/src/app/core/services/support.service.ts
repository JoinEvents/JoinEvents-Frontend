import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Booking } from '../models/booking.model';

export interface SupportTicket {
  id: string;
  ticketNumber?: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt?: string;
  customerName?: string;
  eventName?: string;
  bookingId?: string;
  attachmentUrl?: string;
  replies?: { id: string; message: string; author: string; isInternal: boolean; createdAt: string }[];
}

@Injectable({ providedIn: 'root' })
export class SupportService extends BaseApiService {
  // ---- customer-facing --------------------------------------------------

  getMyTickets(): Observable<SupportTicket[]> {
    return this.listOf<SupportTicket>('/support/my-tickets');
  }

  createTicket(payload: {
    subject: string;
    description: string;
    eventName?: string;
    attachmentUrl?: string;
    bookingId?: string;
  }): Observable<SupportTicket | null> {
    return this.post<unknown>(API_ROUTES.SUPPORT.CREATE_TICKET, payload, false).pipe(
      map(res => this.single<SupportTicket>(res)),
      catchError(() => of(null))
    );
  }

  uploadAttachment(blob: Blob, fileName: string): Observable<string | null> {
    const form = new FormData();
    form.append('file', blob, fileName);
    return this.post<{ url?: string }>('/support/upload', form, false).pipe(
      map(res => res?.url ?? null),
      catchError(() => of(null))
    );
  }

  // ---- agent-facing -----------------------------------------------------

  getDashboardStats(): Observable<Record<string, unknown> | null> {
    return this.get<unknown>(API_ROUTES.SUPPORT.DASHBOARD_STATS, undefined, false).pipe(
      map(res => this.single<Record<string, unknown>>(res)),
      catchError(() => of(null))
    );
  }

  getTickets(): Observable<SupportTicket[]> {
    return this.listOf<SupportTicket>(API_ROUTES.SUPPORT.TICKETS_BASE);
  }

  getTicketById(id: string): Observable<SupportTicket | null> {
    return this.get<unknown>(API_ROUTES.SUPPORT.TICKET_BY_ID(id), undefined, false).pipe(
      map(res => this.single<SupportTicket>(res)),
      catchError(() => of(null))
    );
  }

  reply(id: string, message: string, isInternal = false): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.SUPPORT.TICKET_REPLY(id), { message, isInternal }, false));
  }

  updateTicketStatus(id: string, status?: string, priority?: string): Observable<boolean> {
    return this.ok(this.patch<unknown>(API_ROUTES.SUPPORT.TICKET_STATUS(id), { status, priority }, false));
  }

  // ---- verification queue ------------------------------------------------

  getPendingVendors(): Observable<Record<string, unknown>[]> {
    return this.get<unknown>(API_ROUTES.SUPPORT.PENDING_VENDORS, { t: Date.now() }, false).pipe(
      map(res => this.unwrap(res)),
      catchError(() => of([]))
    );
  }

  verifyVendor(id: string, status: string, remarks?: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.SUPPORT.VERIFY_VENDOR(id), { status, remarks }, false));
  }

  getPendingPackages(): Observable<Record<string, unknown>[]> {
    return this.get<unknown>(API_ROUTES.SUPPORT.PENDING_PACKAGES, { t: Date.now() }, false).pipe(
      map(res => this.unwrap(res)),
      catchError(() => of([]))
    );
  }

  verifyPackage(id: string, status: string, comment?: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.SUPPORT.VERIFY_PACKAGE(id), { status, comment }, false));
  }

  // ---- booking monitor ---------------------------------------------------

  getSupportBookings(): Observable<Booking[]> {
    return this.listOf<Booking>(API_ROUTES.SUPPORT.BOOKINGS);
  }

  addBookingNote(id: string, note: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.SUPPORT.BOOKING_NOTE(id), { note }, false));
  }

  sendUserUpdate(id: string, message: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.SUPPORT.BOOKING_USER_UPDATE(id), { message }, false));
  }

  remindVendor(bookingId: string, vendorId: string): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.SUPPORT.BOOKING_VENDOR_REMINDER(bookingId), { vendorId }, false));
  }

  // ---- review moderation --------------------------------------------------

  getFlaggedReviews(): Observable<Record<string, unknown>[]> {
    return this.listOf(API_ROUTES.SUPPORT.FLAGGED_REVIEWS);
  }

  moderateReview(id: string, action: 'keep' | 'remove'): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.SUPPORT.MODERATE_REVIEW(id), { action }, false));
  }

  // ---- internals ----------------------------------------------------------

  private listOf<T = Record<string, unknown>>(url: string): Observable<T[]> {
    return this.get<unknown>(url, undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as T[]),
      catchError(() => of([] as T[]))
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
