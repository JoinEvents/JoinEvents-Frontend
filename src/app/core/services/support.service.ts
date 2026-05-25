import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupportTicket } from '../models/message.model';
import { Vendor } from '../models/vendor.model';
import { Booking } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class SupportService extends BaseApiService {

  private mapToSupportTicket(raw: any): SupportTicket {
    if (!raw) return null as any;
    return {
      id: raw.id ?? raw.Id ?? '',
      customerId: raw.customerId ?? raw.CustomerId ?? raw.userId ?? raw.UserId ?? '',
      customerName: raw.customerName ?? raw.CustomerName ?? 'Customer',
      subject: raw.subject ?? raw.Subject ?? '',
      status: (() => {
        const s = (raw.status ?? raw.Status ?? 'open').toLowerCase();
        return s === 'inprogress' ? 'in_progress' : s;
      })() as any,
      priority: (raw.priority ?? raw.Priority ?? 'medium').toLowerCase() as any,
      createdAt: raw.createdAt ?? raw.CreatedAt ?? new Date().toISOString(),
      eventName: raw.eventName ?? raw.EventName ?? undefined,
      attachmentUrl: raw.attachmentUrl ?? raw.AttachmentUrl ?? undefined,
      bookingId: raw.bookingId ?? raw.BookingId ?? undefined,
      bookingDetails: (raw.bookingDetails ?? raw.BookingDetails) ? {
        id: (raw.bookingDetails ?? raw.BookingDetails).id ?? (raw.bookingDetails ?? raw.BookingDetails).Id ?? '',
        eventName: (raw.bookingDetails ?? raw.BookingDetails).eventName ?? (raw.bookingDetails ?? raw.BookingDetails).EventName ?? '',
        eventDate: (() => {
          const d = (raw.bookingDetails ?? raw.BookingDetails).eventDate ?? (raw.bookingDetails ?? raw.BookingDetails).EventDate ?? '';
          if (!d) return '';
          const parts = d.split(' ')[0].split('-');
          if (parts.length === 3 && parts[0].length !== 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
          }
          return d;
        })(),
        status: (raw.bookingDetails ?? raw.BookingDetails).status ?? (raw.bookingDetails ?? raw.BookingDetails).Status ?? '',
        totalAmount: (raw.bookingDetails ?? raw.BookingDetails).totalAmount ?? (raw.bookingDetails ?? raw.BookingDetails).TotalAmount ?? 0,
        venue: (raw.bookingDetails ?? raw.BookingDetails).venue ?? (raw.bookingDetails ?? raw.BookingDetails).Venue ?? '',
        city: (raw.bookingDetails ?? raw.BookingDetails).city ?? (raw.bookingDetails ?? raw.BookingDetails).City ?? '',
        guestCount: (raw.bookingDetails ?? raw.BookingDetails).guestCount ?? (raw.bookingDetails ?? raw.BookingDetails).GuestCount ?? 0,
      } : undefined,
      vendorContact: (raw.vendorContact ?? raw.VendorContact) ? {
        businessName: (raw.vendorContact ?? raw.VendorContact).businessName ?? (raw.vendorContact ?? raw.VendorContact).BusinessName ?? '',
        contactName: (raw.vendorContact ?? raw.VendorContact).contactName ?? (raw.vendorContact ?? raw.VendorContact).ContactName ?? '',
        email: (raw.vendorContact ?? raw.VendorContact).email ?? (raw.vendorContact ?? raw.VendorContact).Email ?? '',
        phone: (raw.vendorContact ?? raw.VendorContact).phone ?? (raw.vendorContact ?? raw.VendorContact).Phone ?? ''
      } : undefined,
      messages: (raw.messages ?? raw.Messages ?? []).map((m: any) => ({
        id: m.id ?? m.Id ?? '',
        threadId: m.threadId ?? m.ThreadId ?? '',
        senderId: m.senderId ?? m.SenderId ?? '',
        senderName: m.senderName ?? m.SenderName ?? '',
        senderRole: (m.senderRole ?? m.SenderRole ?? 'customer').toLowerCase() as any,
        content: m.content ?? m.Content ?? '',
        timestamp: m.timestamp ?? m.Timestamp ?? '',
        isRead: m.isRead ?? m.IsRead ?? false,
        type: (m.type ?? m.Type ?? 'text').toLowerCase() as any,
        isInternal: m.isInternal ?? m.IsInternal ?? false
      }))
    };
  }

  // --- Dashboard Stats ---
  getDashboardStats(): Observable<any> {
    return this.get<any>(API_ROUTES.SUPPORT.DASHBOARD_STATS, undefined, false);
  }

  // --- Tickets ---
  getTickets(): Observable<SupportTicket[]> {
    return this.get<SupportTicket[]>(API_ROUTES.SUPPORT.TICKETS_BASE, undefined, false).pipe(
      map(list => (list || []).map(t => this.mapToSupportTicket(t)))
    );
  }

  getMyTickets(): Observable<SupportTicket[]> {
    return this.get<SupportTicket[]>('/support/my-tickets', undefined, false).pipe(
      map(list => (list || []).map(t => this.mapToSupportTicket(t)))
    );
  }

  createTicket(subject: string, description: string, eventName?: string, attachmentUrl?: string, bookingId?: string): Observable<SupportTicket> {
    return this.post<SupportTicket>(API_ROUTES.SUPPORT.CREATE_TICKET, { subject, description, eventName, attachmentUrl, bookingId }, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  uploadAttachment(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.post<{ url: string }>('/support/upload', formData, false);
  }

  getTicketById(id: string): Observable<SupportTicket> {
    return this.get<SupportTicket>(API_ROUTES.SUPPORT.TICKET_BY_ID(id), undefined, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  replyToTicket(id: string, message: string, isInternal: boolean = false): Observable<SupportTicket> {
    return this.post<SupportTicket>(API_ROUTES.SUPPORT.TICKET_REPLY(id), { message, isInternal }, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  updateTicketStatus(id: string, status?: string, priority?: string): Observable<SupportTicket> {
    return this.patch<SupportTicket>(API_ROUTES.SUPPORT.TICKET_STATUS(id), { status, priority }, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  // --- Verifications ---
  getPendingVendors(): Observable<Vendor[]> {
    return this.get<Vendor[]>(API_ROUTES.SUPPORT.PENDING_VENDORS, undefined, false);
  }

  verifyVendor(id: string, status: string, remarks?: string): Observable<Vendor> {
    return this.post<Vendor>(API_ROUTES.SUPPORT.VERIFY_VENDOR(id), { status, remarks }, false);
  }

  getPendingPackages(): Observable<any[]> {
    return this.get<any[]>(API_ROUTES.SUPPORT.PENDING_PACKAGES, undefined, false);
  }

  verifyPackage(id: string, status: string, comment?: string): Observable<any> {
    return this.post<any>(API_ROUTES.SUPPORT.VERIFY_PACKAGE(id), { status, comment }, false);
  }

  // --- Bookings ---
  getSupportBookings(): Observable<Booking[]> {
    return this.get<Booking[]>(API_ROUTES.SUPPORT.BOOKINGS, undefined, false);
  }

  addBookingNote(id: string, note: string): Observable<Booking> {
    return this.post<Booking>(API_ROUTES.SUPPORT.BOOKING_NOTE(id), { note }, false);
  }

  updateUser(id: string, message: string): Observable<Booking> {
    return this.post<Booking>(API_ROUTES.SUPPORT.BOOKING_USER_UPDATE(id), { message }, false);
  }

  remindVendor(bookingId: string, vendorId: string): Observable<any> {
    return this.post<any>(API_ROUTES.SUPPORT.BOOKING_VENDOR_REMINDER(bookingId), { vendorId }, false);
  }

  // --- Reviews ---
  getFlaggedReviews(): Observable<any[]> {
    return this.get<any[]>(API_ROUTES.SUPPORT.FLAGGED_REVIEWS, undefined, false);
  }

  moderateReview(id: string, action: 'keep' | 'remove'): Observable<any> {
    return this.post<any>(API_ROUTES.SUPPORT.MODERATE_REVIEW(id), { action }, false);
  }

}
