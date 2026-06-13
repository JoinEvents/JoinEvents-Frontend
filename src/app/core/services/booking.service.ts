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

  getVendorBookings(): Observable<Booking[]> {
    return this.get<Booking[]>(API_ROUTES.BOOKINGS.VENDOR).pipe(
      tap(bookings => {
        if (bookings) {
          this.globalBookings.set(bookings);
        }
      })
    );
  }

  updateBookingServiceStatus(bookingId: string, serviceId: string, status: string): Observable<boolean> {
    return this.patch<any>(`${API_ROUTES.BOOKINGS.BASE}/${bookingId}/services/${serviceId}/status`, { status }, false).pipe(
      map(() => true)
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

  calculateCancellation(booking: Booking, cancelledBy: 'customer' | 'vendor' | 'system'): {
    refundAmount: number;
    cancellationFee: number;
    platformCancellationFee: number;
    vendorPenaltyAmount: number;
    vendorStrikeApplied: boolean;
    daysUntilEvent: number;
    refundPercentage: number;
  } {
    if (!booking.eventDate) {
      return {
        refundAmount: 0,
        cancellationFee: 0,
        platformCancellationFee: 0,
        vendorPenaltyAmount: 0,
        vendorStrikeApplied: false,
        daysUntilEvent: 0,
        refundPercentage: 0
      };
    }

    const eventDate = new Date(booking.eventDate);
    const now = new Date();
    eventDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffTime = eventDate.getTime() - now.getTime();
    const daysUntilEvent = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const advancePaid = booking.advanceAmount || 0;
    const totalAmount = booking.totalAmount || 0;

    // Default structure
    let refundAmount = 0;
    let cancellationFee = 0;
    let platformCancellationFee = 0;
    let vendorPenaltyAmount = 0;
    let vendorStrikeApplied = false;
    let refundPercentage = 0;

    if (cancelledBy === 'customer') {
      if (booking.status === 'pending') {
        refundAmount = 0;
        cancellationFee = 0;
        platformCancellationFee = 0;
        refundPercentage = 0;
      } else {
        if (daysUntilEvent > 30) {
          // Customer gets refund of advance paid minus platform processing fee (2% of total, capped at 2500)
          platformCancellationFee = Math.min(Math.round(totalAmount * 0.02), 2500);
          refundAmount = Math.max(0, advancePaid - platformCancellationFee);
          cancellationFee = 0;
          refundPercentage = 100;
        } else if (daysUntilEvent >= 15 && daysUntilEvent <= 30) {
          // 50% refund, 50% retained
          const retainedCharge = advancePaid * 0.5;
          refundAmount = advancePaid * 0.5;
          refundPercentage = 50;

          // Platform retains standard fee (10% of total) up to 50% of retained charge
          platformCancellationFee = Math.min(Math.round(totalAmount * 0.10), retainedCharge * 0.5);
          cancellationFee = Math.max(0, retainedCharge - platformCancellationFee);
        } else if (daysUntilEvent >= 7 && daysUntilEvent < 15) {
          // 25% refund, 75% retained
          const retainedCharge = advancePaid * 0.75;
          refundAmount = advancePaid * 0.25;
          refundPercentage = 25;

          platformCancellationFee = Math.min(Math.round(totalAmount * 0.10), retainedCharge * 0.5);
          cancellationFee = Math.max(0, retainedCharge - platformCancellationFee);
        } else {
          // < 7 days: 0% refund, 100% retained
          const retainedCharge = advancePaid;
          refundAmount = 0;
          refundPercentage = 0;

          platformCancellationFee = Math.min(Math.round(totalAmount * 0.10), retainedCharge * 0.5);
          cancellationFee = Math.max(0, retainedCharge - platformCancellationFee);
        }
      }
    } else if (cancelledBy === 'vendor') {
      // 100% refund to customer
      refundAmount = advancePaid;
      cancellationFee = 0;
      platformCancellationFee = 0;
      refundPercentage = 100;

      // Penalty to vendor: 10% of total booking value (capped at 15000)
      vendorPenaltyAmount = Math.min(Math.round(totalAmount * 0.10), 15000);
      vendorStrikeApplied = true;
    } else { // System cancellation
      refundAmount = advancePaid;
      cancellationFee = 0;
      platformCancellationFee = 0;
      refundPercentage = 100;
    }

    return {
      refundAmount: Math.round(refundAmount),
      cancellationFee: Math.round(cancellationFee),
      platformCancellationFee: Math.round(platformCancellationFee),
      vendorPenaltyAmount: Math.round(vendorPenaltyAmount),
      vendorStrikeApplied,
      daysUntilEvent,
      refundPercentage
    };
  }

  cancelBooking(bookingId: string, reason: string, cancelledBy: 'customer' | 'vendor'): Observable<boolean> {
    const booking = this.globalBookings().find(b => b.id === bookingId) || {} as Booking;
    const calc = this.calculateCancellation(booking, cancelledBy);

    const cancellationProps = {
      cancellationDate: new Date().toISOString().split('T')[0],
      refundAmount: calc.refundAmount,
      cancellationFee: calc.cancellationFee,
      platformCancellationFeeRetained: calc.platformCancellationFee,
      vendorPenaltyAmount: calc.vendorPenaltyAmount,
      vendorStrikeApplied: calc.vendorStrikeApplied,
      refundStatus: calc.refundAmount > 0 ? ('pending' as const) : ('none' as const),
      escrowStatus: calc.refundAmount > 0 ? ('refunded' as const) : ('released' as const)
    };

    this.auditService.logEvent(
      cancelledBy === 'vendor' ? 'Vendor Partner' : 'Customer Portal',
      cancelledBy === 'vendor' ? 'system' : 'system',
      'Booking Cancelled',
      `Booking ${booking.bookingNumber || bookingId} cancelled by ${cancelledBy}. Reason: ${reason}. Refund: ₹${calc.refundAmount}, Cancellation Fee: ₹${calc.cancellationFee}, Platform Fee Retained: ₹${calc.platformCancellationFee}.`,
      'booking', bookingId, booking.bookingNumber || bookingId,
      'critical',
      { reason, calc, extra: `Cancelled by: ${cancelledBy}` }
    );

    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { 
        ...b, 
        status: 'cancelled', 
        cancellationReason: reason, 
        cancelledBy,
        ...cancellationProps
      } : b)
    );

    return this.post<any>(API_ROUTES.BOOKINGS.CANCEL(bookingId), { 
      reason, 
      cancelledBy,
      ...cancellationProps
    }, false).pipe(
      map(() => true)
    );
  }

  updateCancellationDetails(bookingId: string, details: Partial<Booking>): Observable<boolean> {
    return this.patch<any>(API_ROUTES.BOOKINGS.CANCELLATION(bookingId), details, false).pipe(
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
