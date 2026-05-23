import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Booking } from '../models/booking.model';
import { EventType } from '../models/event.model';
import { CustomerProfile } from '../models/user.model';
import { EventRfp } from '../models/rfp.model';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DashboardService extends BaseApiService {

  /**
   * Fetch the authenticated customer's profile.
   * GET /customer/profile
   */
  getCustomerProfile(): Observable<CustomerProfile | null> {
    return this.get<any>(API_ROUTES.CUSTOMER.PROFILE).pipe(
      map(res => this.normalizeProfile(res.data || res.profile || res)),
      catchError(() => of(null))
    );
  }

  /**
   * Fetch customer bookings.
   * GET /bookings
   */
  getBookings(): Observable<Booking[]> {
    return this.get<any>(API_ROUTES.BOOKINGS.BASE).pipe(
      map(res => {
        const list = res.bookings || res.data || (Array.isArray(res) ? res : []);
        return list.map((b: any) => this.normalizeBooking(b));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch event categories.
   * GET /event-categories
   */
  getEventCategories(): Observable<EventType[]> {
    return this.get<any>(API_ROUTES.EVENT_CATEGORIES).pipe(
      map(res => {
        const list = res.data || (Array.isArray(res) ? res : []);
        return list.map((c: any) => ({
          id: c.id,
          name: c.name || c.Name,
          nameHindi: c.nameHindi || c.NameHindi,
          description: c.description || c.Description,
          icon: c.icon || c.Icon || 'bi-star',
          category: c.categoryKey || c.category || c.id,
          colorClass: c.colorClass || c.ColorClass || 'event-default',
          gradient: c.gradient || c.Gradient || 'linear-gradient(135deg,#6B21A8,#9333EA)',
          startingPrice: c.startingPrice || c.StartingPrice || 0,
          popularServices: c.popularServices || c.PopularServices || []
        } as EventType));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch customer's RFP requests.
   * GET /rfps
   */
  getRfps(): Observable<EventRfp[]> {
    return this.get<any>(API_ROUTES.RFPS.MY).pipe(
      map(res => {
        const list = res.rfps || res.data || (Array.isArray(res) ? res : []);
        return list.map((r: any) => this.normalizeRfp(r));
      }),
      catchError(() => of([]))
    );
  }

  // ─── Normalizers ────────────────────────────────────────────────

  private normalizeProfile(p: any): CustomerProfile {
    return {
      id: p.Id || p.id,
      name: p.Name || p.name,
      email: p.Email || p.email,
      phone: p.Phone || p.phone,
      role: 'customer',
      city: p.City || p.city || '',
      totalBookings: p.TotalBookings ?? p.totalBookings ?? 0,
      loyaltyPoints: p.LoyaltyPoints ?? p.loyaltyPoints ?? 0,
      totalSpent: p.TotalSpent ?? p.totalSpent ?? 0,
      joinedDate: p.JoinedDate || p.joinedDate,
      accountStatus: p.AccountStatus || p.accountStatus || 'active',
      strikes: p.Strikes ?? p.strikes ?? 0,
    };
  }

  private normalizeBooking(b: any): Booking {
    return {
      id: b.Id || b.id,
      bookingNumber: b.BookingNumber || b.bookingNumber || '',
      customerId: b.CustomerId || b.customerId || '',
      customerName: b.CustomerName || b.customerName || '',
      customerPhone: b.CustomerPhone || b.customerPhone || '',
      eventTypeId: b.EventTypeId || b.eventTypeId || '',
      eventName: b.EventName || b.eventName || '',
      packageId: b.PackageId || b.packageId,
      packageName: b.PackageName || b.packageName,
      eventDate: b.EventDate || b.eventDate || '',
      venue: b.Venue || b.venue || '',
      city: b.City || b.city || '',
      guestCount: b.GuestCount ?? b.guestCount ?? 0,
      status: b.Status || b.status || 'pending',
      advanceAmount: b.AdvanceAmount ?? b.advanceAmount ?? 0,
      baseAmount: b.BaseAmount ?? b.baseAmount ?? 0,
      extraServicesAmount: b.ExtraServicesAmount ?? b.extraServicesAmount ?? 0,
      damageCharges: b.DamageCharges ?? b.damageCharges ?? 0,
      gstPercent: b.GstPercent ?? b.gstPercent ?? 18,
      totalAmount: b.TotalAmount ?? b.totalAmount ?? 0,
      services: b.Services || b.services || [],
      createdAt: b.CreatedAt || b.createdAt || '',
    };
  }

  private normalizeRfp(r: any): EventRfp {
    return {
      id: r.Id || r.id,
      customerId: r.CustomerId || r.customerId || '',
      customerName: r.CustomerName || r.customerName || '',
      title: r.Title || r.title || '',
      eventTypeId: r.EventTypeId || r.eventTypeId || '',
      eventTypeName: r.EventTypeName || r.eventTypeName || '',
      eventDate: r.EventDate || r.eventDate || '',
      city: r.City || r.city || '',
      guestCount: r.GuestCount ?? r.guestCount ?? 0,
      budgetMin: r.BudgetMin ?? r.budgetMin ?? 0,
      budgetMax: r.BudgetMax ?? r.budgetMax ?? 0,
      requirements: r.Requirements || r.requirements || '',
      servicesNeeded: r.ServicesNeeded || r.servicesNeeded || [],
      status: r.Status || r.status || 'open',
      createdAt: r.CreatedAt || r.createdAt || '',
      expiresAt: r.ExpiresAt || r.expiresAt || '',
      bids: r.Bids || r.bids || [],
    };
  }
}
