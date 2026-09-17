import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Browser } from '@capacitor/browser';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';

export interface PaymentIntent {
  providerRef: string;
  checkoutUrl?: string;
  amount: number;
  currency: string;
  status: string;
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
  initiate(req: { bookingId: string; paymentMethod: string; couponCode?: string }): Observable<PaymentIntent | null> {
    return this.post<unknown>(
      API_ROUTES.PAYMENTS.INITIATE,
      { BookingId: req.bookingId, PaymentMethod: req.paymentMethod, CouponCode: req.couponCode },
      false
    ).pipe(
      map(res => this.single<PaymentIntent>(res)),
      catchError(() => of(null))
    );
  }

  confirm(providerRef: string, status: string): Observable<boolean> {
    return this.post<unknown>(API_ROUTES.PAYMENTS.CONFIRM, { ProviderRef: providerRef, Status: status }, false).pipe(
      map(() => true),
      catchError(() => of(false))
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

  private single<T>(res: unknown): T | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as T) ?? null;
  }
}
