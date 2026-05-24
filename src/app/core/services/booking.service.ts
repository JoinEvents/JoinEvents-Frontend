import { inject, Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Booking, BookingStatus } from '../models/booking.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class BookingService extends BaseApiService {

  getBookings(userId: string): Observable<Booking[]> {
    return this.get<Booking[]>(API_ROUTES.BOOKINGS.BASE, { userId });
  }

  updateBookingStatus(bookingId: string, status: BookingStatus): Observable<boolean> {
    return this.patch<any>(API_ROUTES.BOOKINGS.STATUS(bookingId), { status }, false).pipe(
      map(() => true)
    );
  }

  cancelBooking(bookingId: string, reason: string, cancelledBy: 'customer' | 'vendor'): Observable<boolean> {
    return this.post<any>(API_ROUTES.BOOKINGS.CANCEL(bookingId), { reason, cancelledBy }, false).pipe(
      map(() => true)
    );
  }

  addDamageCharges(bookingId: string, amount: number, notes: string): Observable<boolean> {
    return this.post<any>(API_ROUTES.BOOKINGS.DAMAGE(bookingId), { amount, notes }, false).pipe(
      map(() => true)
    );
  }

  raiseDispute(bookingId: string, reason: string): Observable<boolean> {
    return this.post<any>(`/bookings/${bookingId}/dispute`, { reason }, false).pipe(
      map(() => true)
    );
  }

  createBooking(booking: any): Observable<any> {
    return this.post<any>('/booking', booking, false);
  }
}
