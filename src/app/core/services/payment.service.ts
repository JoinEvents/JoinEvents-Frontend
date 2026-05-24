import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PaymentService extends BaseApiService {

  initiatePayment(req: { bookingId: string; paymentMethod: string; couponCode?: string }): Observable<any> {
    return this.post<any>('/payment/initiate', req, false);
  }

  confirmPayment(payload: { providerRef: string; status: string }): Observable<any> {
    return this.post<any>('/payment/confirm', payload, false);
  }
}
