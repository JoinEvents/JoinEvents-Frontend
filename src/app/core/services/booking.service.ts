import { inject, Injectable, signal } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Booking, BookingStatus } from '../models/booking.model';
import { Observable, of } from 'rxjs';
import { map, tap, catchError, delay } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditSeverity } from '../models/audit-log.model';

const BOOKING_MAP: Record<string, { number: string; name: string }> = {
  bk001: { number: 'EE-2025-001', name: 'Rajesh Kumar' },
  bk002: { number: 'EE-2025-002', name: 'Rajesh Kumar' },
  bk003: { number: 'EE-2026-001', name: 'Rajesh Kumar' },
  bk004: { number: 'EE-2026-002', name: 'Sunita Patel' },
  bk005: { number: 'EE-2026-003', name: 'Anand Reddy' }
};

@Injectable({ providedIn: 'root' })
export class BookingService extends BaseApiService {
  private auditService = inject(AuditService);

  globalBookings = signal<Booking[]>([
    { 
      id: 'bk001', bookingNumber: 'EE-2025-001', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'wedding', eventName: 'Wedding Reception', packageId: 'w-std', packageName: 'Gold Wedding', eventDate: '2025-12-15', venue: 'Raj Mahal Banquet Hall', city: 'Hyderabad', guestCount: 450, status: 'confirmed', advanceAmount: 70000, baseAmount: 350000, extraServicesAmount: 45000, damageCharges: 0, gstPercent: 18, totalAmount: 464100, 
      services: [
        { serviceId: 's1', serviceName: 'Premium Catering', category: 'catering', vendorId: 'v1', vendorName: 'Spice Garden Catering', price: 25000, status: 'confirmed' },
        { serviceId: 's2', serviceName: 'Floral Decoration', category: 'decoration', vendorId: 'v2', vendorName: 'Blooms & Bliss', price: 20000, status: 'confirmed' }
      ], 
      createdAt: '2025-10-01', assignedTo: 'Priya Nair',
      internalNotes: 'VIP customer, prefers floral decor in pastel shades.',
      supportLogs: [
        { date: '2025-10-02', message: 'Welcome call done. Explained the process.', actor: 'Priya' },
        { date: '2025-10-05', message: 'Vendor V1 confirmed the menu.', actor: 'Priya' }
      ]
    },
    { 
      id: 'bk002', bookingNumber: 'EE-2025-002', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'birthday', eventName: "Daughter's 10th Birthday", eventDate: '2025-11-20', venue: 'Fun Zone Party Hall', city: 'Hyderabad', guestCount: 80, status: 'settled', advanceAmount: 12000, baseAmount: 60000, extraServicesAmount: 8000, damageCharges: 2000, gstPercent: 18, totalAmount: 82600, services: [], createdAt: '2025-09-15', assignedTo: 'Rahul Support',
      supportLogs: [{ date: '2025-09-16', message: 'Payment verified.', actor: 'System' }]
    },
    { id: 'bk004', bookingNumber: 'EE-2026-002', customerId: 'c2', customerName: 'Sunita Patel', customerPhone: '+91 97654 32109', eventTypeId: 'corporate', eventName: 'Annual Day Conference', packageId: 'c-std', packageName: 'Corporate Event', eventDate: '2026-06-05', venue: 'Novotel Business Center', city: 'Bangalore', guestCount: 150, status: 'advance_paid', advanceAmount: 40000, baseAmount: 200000, extraServicesAmount: 25000, damageCharges: 0, gstPercent: 18, totalAmount: 265300, services: [], createdAt: '2026-04-01', assignedTo: 'Priya Nair' },
    { id: 'bk005', bookingNumber: 'EE-2026-003', customerId: 'c3', customerName: 'Anand Reddy', customerPhone: '+91 96543 21098', eventTypeId: 'religious', eventName: 'Upanayanam Ceremony', packageId: 'r-prem', packageName: 'Grand Hawan', eventDate: '2026-07-15', venue: 'Community Hall', city: 'Chennai', guestCount: 180, status: 'in_progress', advanceAmount: 24000, baseAmount: 120000, extraServicesAmount: 15000, damageCharges: 0, gstPercent: 18, totalAmount: 160300, services: [], createdAt: '2026-03-20', assignedTo: 'Rahul Support' },
  ]);

  getBookings(userId: string): Observable<Booking[]> {
    const list = this.globalBookings();
    const result = userId ? list.filter(b => b.customerId === userId) : list;
    return this.get<Booking[]>(API_ROUTES.BOOKINGS.BASE, { userId }).pipe(
      catchError(() => of(result).pipe(delay(300)))
    );
  }

  getAdminBookings(): Observable<Booking[]> {
    return this.get<Booking[]>(API_ROUTES.ADMIN.BOOKINGS).pipe(
      tap(apiBookings => {
        if (apiBookings && apiBookings.length > 0) {
          this.globalBookings.set(apiBookings);
        }
      }),
      catchError(() => of(this.globalBookings()).pipe(delay(300)))
    );
  }

  updateBookingStatus(bookingId: string, status: BookingStatus): Observable<boolean> {
    const booking = BOOKING_MAP[bookingId] || { number: bookingId, name: 'Customer' };
    this.auditService.logEvent(
      'Priya Nair', 'admin',
      'Booking Status Changed',
      `Admin Priya Nair changed status of booking ${booking.number} to ${status}.`,
      'booking', bookingId, booking.number,
      status === 'cancelled' ? 'critical' : 'warning',
      { after: { status }, reason: 'Status updated by admin panel' }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, status } : b)
    );
    return this.patch<any>(API_ROUTES.BOOKINGS.STATUS(bookingId), { status }, false).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  cancelBooking(bookingId: string, reason: string, cancelledBy: 'customer' | 'vendor'): Observable<boolean> {
    const booking = BOOKING_MAP[bookingId] || { number: bookingId, name: 'Customer' };
    this.auditService.logEvent(
      cancelledBy === 'vendor' ? 'Vendor Partner' : 'Customer Portal',
      cancelledBy === 'vendor' ? 'system' : 'system',
      'Booking Cancelled',
      `Booking ${booking.number} cancelled by ${cancelledBy}. Reason: ${reason}.`,
      'booking', bookingId, booking.number,
      'critical',
      { reason, extra: `Cancelled by: ${cancelledBy}` }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, status: 'cancelled', cancellationReason: reason, cancelledBy } : b)
    );
    return this.post<any>(API_ROUTES.BOOKINGS.CANCEL(bookingId), { reason, cancelledBy }, false).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  addDamageCharges(bookingId: string, amount: number, notes: string): Observable<boolean> {
    const booking = BOOKING_MAP[bookingId] || { number: bookingId, name: 'Customer' };
    this.auditService.logEvent(
      'Priya Nair', 'admin',
      'Damage Charges Added',
      `Admin Priya Nair added damage charges of ₹${amount.toLocaleString('en-IN')} to booking ${booking.number}. Notes: ${notes}.`,
      'booking', bookingId, booking.number,
      'warning',
      { amount, reason: notes }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, damageCharges: amount, damageChargeNotes: notes, isDamageChargeApproved: false } : b)
    );
    return this.post<any>(API_ROUTES.BOOKINGS.DAMAGE(bookingId), { amount, notes }, false).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  raiseDispute(bookingId: string, reason: string): Observable<boolean> {
    const booking = BOOKING_MAP[bookingId] || { number: bookingId, name: 'Customer' };
    this.auditService.logEvent(
      'Priya Nair', 'admin',
      'Dispute Raised',
      `Admin Priya Nair opened a dispute on booking ${booking.number} — Reason: ${reason}`,
      'booking', bookingId, booking.number,
      'critical',
      { reason }
    );
    this.globalBookings.update(list =>
      list.map(b => b.id === bookingId ? { ...b, status: 'disputed', disputeInfo: { reason, status: 'open' } } : b)
    );
    return this.post<any>(`/bookings/${bookingId}/dispute`, { reason }, false).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  createBooking(booking: any): Observable<any> {
    return this.post<any>('/booking', booking, false);
  }

  assignBooking(bookingId: string, employeeName: string): Observable<boolean> {
    const booking = BOOKING_MAP[bookingId] || { number: bookingId, name: 'Customer' };
    this.auditService.logEvent(
      'Priya Nair', 'admin',
      'Booking Assigned',
      `Admin Priya Nair assigned booking ${booking.number} to support agent ${employeeName}.`,
      'booking', bookingId, booking.number,
      'info', { after: { assignedTo: employeeName } }
    );
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, assignedTo: employeeName } : b)
    );
    return this.post<any>(API_ROUTES.ADMIN.ASSIGN_BOOKING(bookingId), { assignedTo: employeeName }, false).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  addSupportLog(bookingId: string, message: string, actor: string): Observable<boolean> {
    const booking = BOOKING_MAP[bookingId] || { number: bookingId, name: 'Customer' };
    this.auditService.logEvent(
      actor || 'Priya Nair', 'support',
      'Support Log Added',
      `Support agent "${actor || 'Priya'}" added support log to booking ${booking.number}: "${message}".`,
      'booking', bookingId, booking.number,
      'info', { extra: `Customer: ${booking.name} | Note: ${message}` }
    );
    const newLog = { date: new Date().toISOString().split('T')[0], message, actor: actor || 'Priya' };
    this.globalBookings.update(list => 
      list.map(b => b.id === bookingId ? { ...b, supportLogs: [...(b.supportLogs || []), newLog] } : b)
    );
    return this.post<any>(`/support/bookings/${bookingId}/logs`, { message, actor }, false).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }
}
