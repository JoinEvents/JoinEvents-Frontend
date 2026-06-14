import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseApiService } from './base-api.service';
import { EventRfp, RfpBid } from '../models/rfp.model';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class RfpService extends BaseApiService {

  getRfps(customerId: string): Observable<EventRfp[]> {
    // Security: Ideally, customerId should be derived from the JWT token on the server side
    // rather than being passed as a query parameter. The X-User-Context header provides
    // additional context while the backend is updated to use token-based user resolution.
    const params = new HttpParams().set('customerId', customerId);
    const headers = new HttpHeaders()
      .set('X-User-Context', customerId);
    return this.http.get<ApiResponse<EventRfp[]>>(`${this.baseUrl}/quotes`, { params, headers })
      .pipe(map(res => res.data || []));
  }

  getAllOpenRfps(): Observable<EventRfp[]> {
    return this.get<ApiResponse<EventRfp[]>>('/quotes/open')
      .pipe(map(res => res.data || []));
  }

  getRfpById(id: string): Observable<EventRfp | undefined> {
    return this.get<ApiResponse<EventRfp>>(`/quotes/${id}`)
      .pipe(map(res => res.data));
  }

  createRfp(rfp: Partial<EventRfp>): Observable<EventRfp> {
    return this.post<ApiResponse<EventRfp>>('/quotes', rfp)
      .pipe(map(res => res.data));
  }

  updateRfp(id: string, updatedData: Partial<EventRfp>): Observable<EventRfp> {
    return this.put<ApiResponse<EventRfp>>(`/quotes/${id}`, updatedData)
      .pipe(map(res => res.data));
  }

  deleteRfp(id: string): Observable<boolean> {
    return this.delete<ApiResponse<boolean>>(`/quotes/${id}`)
      .pipe(map(res => !!res.data));
  }

  submitBid(rfpId: string, bid: Partial<RfpBid>): Observable<RfpBid> {
    return this.post<ApiResponse<RfpBid>>(`/quotes/${rfpId}/offers`, bid)
      .pipe(map(res => res.data));
  }

  acceptBid(rfpId: string, bidId: string): Observable<boolean> {
    return this.post<ApiResponse<boolean>>(`/quotes/${rfpId}/offers/${bidId}/accept`, {})
      .pipe(map(res => !!res.data));
  }
}
