import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { VendorAnalyticsData } from './analytics.service';

@Injectable({
  providedIn: 'root'
})
export class VendorDashboardService extends BaseApiService {

  getDashboardData(): Observable<any> {
    return this.get<any>(API_ROUTES.VENDOR.DASHBOARD).pipe(
      map(res => res.data || res),
      catchError(() => of({
        vendorName: '',
        isVerified: false,
        recentRequests: []
      }))
    );
  }

  getDashboardTasks(): Observable<any[]> {
    return this.get<any>(API_ROUTES.VENDOR.TASKS).pipe(
      map(res => res.data || res || []),
      catchError(() => of([]))
    );
  }

  getAnalytics(): Observable<VendorAnalyticsData | null> {
    return this.get<any>(API_ROUTES.VENDOR.ANALYTICS).pipe(
      map(res => (res.data || res) as VendorAnalyticsData),
      catchError(() => of(null))
    );
  }

  getPendingCollaborations(): Observable<any[]> {
    return this.get<any>(API_ROUTES.VENDOR.COLLABORATIONS).pipe(
      map(res => res.data || res || []),
      catchError(() => of([]))
    );
  }

  acceptCollaboration(id: string): Observable<boolean> {
    return this.post<any>(API_ROUTES.VENDOR.COLLABORATION_ACCEPT(id), {}).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  getCustomerEnquiries(): Observable<any[]> {
    return this.get<any>(API_ROUTES.VENDOR.ENQUIRIES).pipe(
      map(res => res.data || res || []),
      catchError(() => of([]))
    );
  }

  sendEnquiryReply(id: string, replyType: string): Observable<boolean> {
    return this.post<any>(API_ROUTES.VENDOR.ENQUIRY_REPLY(id), { messageType: replyType }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  getLoyaltyStatus(): Observable<any> {
    return this.get<any>(API_ROUTES.VENDOR.LOYALTY).pipe(
      map(res => res.data || res),
      catchError(() => of({
        current: 'Gold Partner',
        next: 'Platinum',
        points: 0,
        needed: 1000
      }))
    );
  }

  getRevenueTarget(): Observable<any> {
    return this.get<any>(API_ROUTES.VENDOR.GROWTH_TARGET).pipe(
      map(res => res.data || res),
      catchError(() => of({
        current: 0,
        target: 200000,
        percentage: 0
      }))
    );
  }

  getEsgSnapshot(): Observable<any> {
    return this.get<any>(API_ROUTES.VENDOR.ESG_IMPACT).pipe(
      map(res => res.data || res),
      catchError(() => of({
        score: 0,
        offset: '0 Tons',
        trend: '0%'
      }))
    );
  }
}
