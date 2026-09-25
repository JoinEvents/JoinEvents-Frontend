import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable } from 'rxjs';

export interface PaymentInitiation {
  paymentId: string;
  providerRef: string;
  /** What this payment charges, as decided by the server. */
  amount: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentService extends BaseApiService {

  /**
   * Starts a payment. The server decides the amount: the advance, the whole total when
   * payInFull is set on an unpaid booking, or whatever balance is still due.
   */
  initiatePayment(req: { bookingId: string; paymentMethod: string; payInFull?: boolean }): Observable<PaymentInitiation> {
    return this.post<PaymentInitiation>('/payment/initiate', {
      BookingId: req.bookingId,
      PaymentMethod: req.paymentMethod,
      PayInFull: !!req.payInFull
    }, false);
  }

  /** The outcome is read back from the payment provider by the server. */
  confirmPayment(providerRef: string): Observable<{ status: string }> {
    return this.post<{ status: string }>('/payment/confirm', { ProviderRef: providerRef }, false);
  }
}
