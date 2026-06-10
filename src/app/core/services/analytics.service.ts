import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map, catchError } from 'rxjs/operators';
import { BookingService } from './booking.service';
import { environment } from '../../../environments/environment';

export interface AdminAnalyticsData {
  totalRevenue: number;
  monthlyRevenue: number[];
  bookingCountByStatus: Record<string, number>;
  top5VendorsByEarnings: any[];
  customerAcquisitionByMonth: number[];
  averageBookingValue: number;
  // Platform Revenue (computed from backend booking data)
  platformCommissionTotal: number;
  monthlyCommission: number[];
  subscriptionRevenue: number;
  vendorPayoutTotal: number;
  tdsCollected: number;
  revenueByCategory: Record<string, number>;
}

export interface VendorAnalyticsData {
  totalEarnings: number;
  monthlyEarnings: number[];
  bookingCountByStatus: Record<string, number>;
  averageRatingTrend: number[];
  topPerformingService: any;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private bookingService = inject(BookingService);

  getAdminAnalytics(): Observable<AdminAnalyticsData> {
    return this.bookingService.getAdminBookings().pipe(
      map(bookings => {
        let totalRevenue = 0;
        const monthlyRevenue = Array(12).fill(0);
        const bookingCountByStatus: Record<string, number> = {
          pending: 0,
          advance_paid: 0,
          confirmed: 0,
          in_progress: 0,
          completed: 0,
          settled: 0,
          cancelled: 0
        };
        const customerAcquisitionByMonth = [15, 20, 24, 18, 30, 35, 28, 45, 40, 52, 60, 75];

        bookings.forEach(b => {
          totalRevenue += b.totalAmount;
          bookingCountByStatus[b.status] = (bookingCountByStatus[b.status] || 0) + 1;
          
          if (b.eventDate) {
            const parts = b.eventDate.split('-');
            const month = parseInt(parts[1], 10) - 1;
            if (month >= 0 && month < 12) {
              monthlyRevenue[month] += b.totalAmount;
            }
          }
        });

        const top5VendorsByEarnings = [
          { vendorId: 'v1', vendorName: 'Spice Garden Catering', totalEarnings: 450000, category: 'Catering' },
          { vendorId: 'v2', vendorName: 'Blooms & Bliss Decor', totalEarnings: 320000, category: 'Decoration' },
          { vendorId: 'v3', vendorName: 'Grand Hyatt Lawn', totalEarnings: 280000, category: 'Venue' },
          { vendorId: 'v4', vendorName: 'Pixel Perfect Photography', totalEarnings: 150000, category: 'Photography' },
          { vendorId: 'v5', vendorName: 'DJ Spark', totalEarnings: 90000, category: 'Music' }
        ];

        const averageBookingValue = bookings.length ? totalRevenue / bookings.length : 0;

        // Platform Revenue Calculations (display estimates — actual figures come from backend reports)
        let platformCommissionTotal = 0;
        const monthlyCommission = Array(12).fill(0);
        let vendorPayoutTotal = 0;
        let tdsCollected = 0;
        const revenueByCategory: Record<string, number> = {};
        const defaultRate = 0.10;
        const tdsRate = 0.01;

        bookings.forEach(b => {
          const category = b.eventTypeId || 'wedding';
          const commission = Math.round(b.totalAmount * defaultRate);
          const tds = Math.round(b.totalAmount * tdsRate);
          const gstOnComm = Math.round(commission * 0.18);
          const platformRev = commission - gstOnComm;

          platformCommissionTotal += platformRev;
          vendorPayoutTotal += (b.totalAmount - commission - tds);
          tdsCollected += tds;
          revenueByCategory[category] = (revenueByCategory[category] || 0) + platformRev;

          if (b.eventDate) {
            const parts = b.eventDate.split('-');
            const month = parseInt(parts[1], 10) - 1;
            if (month >= 0 && month < 12) {
              monthlyCommission[month] += platformRev;
            }
          }
        });

        // Estimated subscription revenue (would come from backend in production)
        const subscriptionRevenue = (999 * 45) + (2999 * 12);

        return {
          totalRevenue,
          monthlyRevenue,
          bookingCountByStatus,
          top5VendorsByEarnings,
          customerAcquisitionByMonth,
          averageBookingValue,
          platformCommissionTotal,
          monthlyCommission,
          subscriptionRevenue,
          vendorPayoutTotal,
          tdsCollected,
          revenueByCategory,
        };
      }),
      delay(300)
    );
  }

  getVendorAnalytics(vendorId: string): Observable<VendorAnalyticsData> {
    const fallbackServices = [
      { id: 'vs1', vendorId: 'v1', vendorName: 'Spice Garden Catering', category: 'catering', name: 'Premium Veg Catering', description: 'Authentic South Indian & North Indian multi-cuisine veg catering', pricePerUnit: 450, unit: 'per plate', minGuests: 100, maxGuests: 1000, city: 'Hyderabad', images: [], rating: 4.8, totalReviews: 245, isActive: true, isVerified: true },
      { id: 'vs2', vendorId: 'v1', vendorName: 'Spice Garden Catering', category: 'catering', name: 'Non-Veg Catering Deluxe', description: 'Premium non-veg multi-cuisine catering with live counters', pricePerUnit: 650, unit: 'per plate', minGuests: 50, maxGuests: 800, city: 'Hyderabad', images: [], rating: 4.7, totalReviews: 198, isActive: true, isVerified: true },
      { id: 'vs5', vendorId: 'v1', vendorName: 'Spice Garden Catering', category: 'catering', name: 'Gourmet Dessert Counter', description: 'Premium live dessert counters with international delicacies', pricePerUnit: 150, unit: 'per plate', minGuests: 100, maxGuests: 500, city: 'Hyderabad', images: [], rating: 0, totalReviews: 0, isActive: true, isVerified: false }
    ].filter(s => s.vendorId === vendorId);

    return this.http.get<any>(`${environment.apiUrl}/services/getAll?VendorId=${vendorId}`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(res => res.Services || res.services || fallbackServices),
      catchError(() => of(fallbackServices)),
      map(services => {
        const totalEarnings = 850000;
        const monthlyEarnings = [40000, 50000, 65000, 45000, 80000, 95000, 70000, 110000, 85000, 120000, 150000, 180000];
        const bookingCountByStatus = {
          pending: 4,
          accepted: 3,
          declined: 1,
          completed: 87
        };
        const averageRatingTrend = [4.5, 4.6, 4.6, 4.7, 4.7, 4.8, 4.8, 4.8, 4.9, 4.8, 4.9, 4.8];
        const topPerformingService = services.length ? services[0] : null;

        return {
          totalEarnings,
          monthlyEarnings,
          bookingCountByStatus,
          averageRatingTrend,
          topPerformingService
        };
      }),
      delay(300)
    );
  }
}
