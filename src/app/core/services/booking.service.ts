import { inject, Injectable, signal } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Booking, BookingStatus } from '../models/booking.model';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable({ providedIn: 'root' })
export class BookingService extends BaseApiService {
  private auditService = inject(AuditService);

  // This is an empty state container. It does NOT contain mock data.
  // Data is pulled from the API and stored here so components don't have to refetch constantly.
  globalBookings = signal<Booking[]>([]);

  getBookings(userId: string): Observable<Booking[]> {
    return this.get<Booking[]>(API_ROUTES.BOOKINGS.BASE, { userId }).pipe(
      tap(bookings => {
        if (bookings) {
          this.globalBookings.set(bookings); // Fill the empty container with API data
        }
      })
    );
  }

  getAdminBookings(): Observable<Booking[]> {
    return this.get<Booking[]>(API_ROUTES.ADMIN.BOOKINGS).pipe(
      tap(apiBookings => {
        if (apiBookings) {
          this.globalBookings.set(apiBookings);
        }
      })
    );
  }

  updateBookingStatus(bookingId: string, status: BookingStatus): Observable<boolean> {
    const booking = this.globalBookings().find(b => b.id === bookingId) || { bookingNumber: bookingId };
    this.auditService.logEvent(
      'System User', 'admin',
      'Booking Status Changed',
      `Status of booking ${booking.bookingNumber} changed to ${status}.`,
      'booking', bookingId, booking.bookingNumber,
      status === 'cancelled' ? 'critical' : 'warning',
      { after: { status }, reason: 'Status updated' }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, status } : b)
    );
    return this.patch<any>(API_ROUTES.BOOKINGS.STATUS(bookingId), { status }, false).pipe(
      map(() => true)
    );
  }

  cancelBooking(bookingId: string, reason: string, cancelledBy: 'customer' | 'vendor'): Observable<boolean> {
    const booking = this.globalBookings().find(b => b.id === bookingId) || { bookingNumber: bookingId };
    this.auditService.logEvent(
      cancelledBy === 'vendor' ? 'Vendor Partner' : 'Customer Portal',
      cancelledBy === 'vendor' ? 'system' : 'system',
      'Booking Cancelled',
      `Booking ${booking.bookingNumber} cancelled by ${cancelledBy}. Reason: ${reason}.`,
      'booking', bookingId, booking.bookingNumber,
      'critical',
      { reason, extra: `Cancelled by: ${cancelledBy}` }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, status: 'cancelled', cancellationReason: reason, cancelledBy } : b)
    );
    return this.post<any>(API_ROUTES.BOOKINGS.CANCEL(bookingId), { reason, cancelledBy }, false).pipe(
      map(() => true)
    );
  }

  addDamageCharges(bookingId: string, amount: number, notes: string): Observable<boolean> {
    const booking = this.globalBookings().find(b => b.id === bookingId) || { bookingNumber: bookingId };
    this.auditService.logEvent(
      'System Admin', 'admin',
      'Damage Charges Added',
      `Damage charges of ₹${amount.toLocaleString('en-IN')} added to booking ${booking.bookingNumber}. Notes: ${notes}.`,
      'booking', bookingId, booking.bookingNumber,
      'warning',
      { amount, reason: notes }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, damageCharges: amount, damageChargeNotes: notes, isDamageChargeApproved: false } : b)
    );
    return this.post<any>(API_ROUTES.BOOKINGS.DAMAGE(bookingId), { amount, notes }, false).pipe(
      map(() => true)
    );
  }

  raiseDispute(bookingId: string, reason: string): Observable<boolean> {
    const booking = this.globalBookings().find(b => b.id === bookingId) || { bookingNumber: bookingId };
    this.auditService.logEvent(
      'System Admin', 'admin',
      'Dispute Raised',
      `Dispute opened on booking ${booking.bookingNumber} — Reason: ${reason}`,
      'booking', bookingId, booking.bookingNumber,
      'critical',
      { reason }
    );
    this.globalBookings.update(list =>
      list.map(b => b.id === bookingId ? { ...b, status: 'disputed', disputeInfo: { reason, status: 'open' } } : b)
    );
    return this.post<any>(API_ROUTES.BOOKINGS.DISPUTE(bookingId), { reason }, false).pipe(
      map(() => true)
    );
  }

  createBooking(booking: any): Observable<any> {
    return this.post<any>(API_ROUTES.BOOKINGS.CREATE, booking, false);
  }

  assignBooking(bookingId: string, employeeName: string): Observable<boolean> {
    const booking = this.globalBookings().find(b => b.id === bookingId) || { bookingNumber: bookingId };
    this.auditService.logEvent(
      'System Admin', 'admin',
      'Booking Assigned',
      `Booking ${booking.bookingNumber} assigned to support agent ${employeeName}.`,
      'booking', bookingId, booking.bookingNumber,
      'info', { after: { assignedTo: employeeName } }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, assignedTo: employeeName } : b)
    );
    return this.post<any>(API_ROUTES.ADMIN.ASSIGN_BOOKING(bookingId), { assignedTo: employeeName }, false).pipe(
      map(() => true)
    );
  }

  addSupportLog(bookingId: string, message: string, actor: string): Observable<boolean> {
    const booking = this.globalBookings().find(b => b.id === bookingId) || { bookingNumber: bookingId, customerName: 'Customer' };
    this.auditService.logEvent(
      actor || 'System Support', 'support',
      'Support Log Added',
      `Support agent "${actor || 'System'}" added support log to booking ${booking.bookingNumber}: "${message}".`,
      'booking', bookingId, booking.bookingNumber,
      'info', { extra: `Customer: ${booking.customerName} | Note: ${message}` }
    );
    const newLog = { date: new Date().toISOString().split('T')[0], message, actor: actor || 'System' };
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, supportLogs: [...(b.supportLogs || []), newLog] } : b)
    );
    return this.post<any>(API_ROUTES.BOOKINGS.LOGS(bookingId), { message, actor }, false).pipe(
      map(() => true)
    );
  }
}
