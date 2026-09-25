import { Injectable } from '@angular/core';

/**
 * What the booking form hands to checkout: the booking the customer has chosen, with no
 * prices. Checkout prices it again on the server, and the booking itself is created only
 * when the customer pays, so an abandoned checkout never holds the vendor's date.
 */
export interface CheckoutDraft {
  packageId: string;
  vendorId?: string;
  packageName: string;
  image?: string;
  eventName: string;
  eventDate: string;
  venue: string;
  city: string;
  guestCount: number;
}

const KEY = 'je.checkoutDraft';

@Injectable({ providedIn: 'root' })
export class CheckoutDraftService {
  private draft: CheckoutDraft | null = null;

  set(draft: CheckoutDraft): void {
    this.draft = draft;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Kept in memory only.
    }
  }

  get(): CheckoutDraft | null {
    if (this.draft) return this.draft;
    try {
      const raw = sessionStorage.getItem(KEY);
      this.draft = raw ? (JSON.parse(raw) as CheckoutDraft) : null;
    } catch {
      this.draft = null;
    }
    return this.draft;
  }

  clear(): void {
    this.draft = null;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Nothing stored.
    }
  }
}
