import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { validateFileUpload } from '../utils/input-sanitizer.util';
import { CalendarDay } from '../models/vendor.model';

@Injectable({
  providedIn: 'root'
})
export class VendorService extends BaseApiService {
  
  getDashboard(): Observable<any> {
    return this.get<any>('/vendor/dashboard', undefined, false);
  }

  getDashboardTasks(): Observable<any[]> {
    return this.get<any[]>('/vendor/dashboard/tasks', undefined, false);
  }

  getVerificationStatus(): Observable<any> {
    return this.get<any>('/vendor/verification/status', { t: Date.now().toString() }, false);
  }

  uploadVerificationDocument(file: File, documentType: string): Observable<any> {
    const validation = validateFileUpload(file, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], 10 * 1024 * 1024);
    if (!validation.valid) {
      return throwError(() => new Error(validation.error));
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    
    return this.post<any>('/vendor/verification/upload', formData, false);
  }

  getCalendar(month?: number, year?: number): Observable<CalendarDay[]> {
    const params: any = {};
    if (month) params.month = month;
    if (year) params.year = year;
    return this.get<any[]>('/vendor/calendar', params, false).pipe(
      map(days => days.map(d => ({
        date: d.Date || d.date,
        status: d.Status || d.status,
        bookingId: d.BookingId || d.bookingId,
        eventName: d.EventName || d.eventName,
        customerName: d.CustomerName || d.customerName,
        totalAmount: d.TotalAmount || d.totalAmount,
        packageName: d.PackageName || d.packageName
      })))
    );
  }

  toggleCalendarDay(date: string, reason?: string): Observable<CalendarDay> {
    return this.post<any>('/vendor/calendar/toggle', { date, reason }, false).pipe(
      map(d => ({
        date: d.Date || d.date,
        status: d.Status || d.status,
        bookingId: d.BookingId || d.bookingId
      }))
    );
  }

  bulkBlockDates(dates: string[], reason?: string): Observable<CalendarDay[]> {
    return this.post<any[]>('/vendor/calendar/bulk-block', { dates, reason }, false).pipe(
      map(days => days.map(d => ({
        date: d.Date || d.date,
        status: d.Status || d.status,
        bookingId: d.BookingId || d.bookingId
      })))
    );
  }

  bulkReleaseDates(dates: string[]): Observable<CalendarDay[]> {
    return this.post<any[]>('/vendor/calendar/bulk-release', { dates }, false).pipe(
      map(days => days.map(d => ({
        date: d.Date || d.date,
        status: d.Status || d.status,
        bookingId: d.BookingId || d.bookingId
      })))
    );
  }

  checkAvailability(vendorId: string, date: string): Observable<{ available: boolean }> {
    return this.get<any>(`/vendor/${vendorId}/calendar/check`, { date }, false).pipe(
      map(res => ({
        available: res.Available !== undefined ? res.Available : (res.available !== undefined ? res.available : true)
      }))
    );
  }

  checkBulkAvailability(vendorIds: string[], date: string): Observable<Record<string, boolean>> {
    return this.get<Record<string, boolean>>('/vendor/calendar/bulk-availability', { date, vendorIds: vendorIds.join(',') }, false);
  }
}

