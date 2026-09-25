import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Browser } from '@capacitor/browser';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { ApiResult, toResult } from '../utils/result.util';

/** A started payment. The server decides the amount. */
export interface PaymentStart {
  paymentId: string;
  providerRef: string;
  amount: number;
  /** A hosted gateway page, when the provider needs one. */
  checkoutUrl?: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  bookingNumber?: string;
  amount: number;
  method: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  paidAt: string;
  invoiceUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService extends BaseApiService {
  /**
   * Starts a payment: the advance, the whole total when payInFull is set on an unpaid booking,
   * or whatever balance is still due — the server decides.
   */
  start(bookingId: string, paymentMethod: string, payInFull: boolean): Observable<ApiResult<PaymentStart>> {
    return toResult(
      this.post<PaymentStart>(
        API_ROUTES.PAYMENTS.INITIATE,
        { BookingId: bookingId, PaymentMethod: paymentMethod, PayInFull: payInFull },
        false
      ),
      'Payment could not be started. Please try again.'
    );
  }

  /** The outcome is read back from the payment provider by the server. */
  verify(providerRef: string): Observable<ApiResult<{ status: string }>> {
    return toResult(
      this.post<{ status: string }>(API_ROUTES.PAYMENTS.CONFIRM, { ProviderRef: providerRef }, false),
      'We could not confirm the payment. Check your booking for its status.'
    );
  }

  getHistory(): Observable<PaymentRecord[]> {
    return this.get<unknown>(API_ROUTES.PAYMENTS.HISTORY, undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as PaymentRecord[]),
      catchError(() => of([] as PaymentRecord[]))
    );
  }

  /**
   * Opens the gateway's hosted page in an in-app browser tab (SFSafariViewController
   * on iOS, Custom Tabs on Android). A payment page must never run inside the app's
   * own WebView: the user cannot see the real URL or certificate there, and card
   * autofill will not offer to fill it.
   */
  async openCheckout(url: string): Promise<void> {
    await Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#FF6B35' });
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? []) as Record<string, unknown>[]);
  }
}
