/**
 * What the package page hands to checkout: the booking the customer has chosen, with no
 * prices. Checkout asks the server for the price again, so an amount can never go stale or be
 * edited in the browser.
 */
export interface CheckoutDraft {
  /** Set when paying for a booking that already exists (a balance, or a retried payment). */
  bookingId?: string;
  packageId?: string;
  vendorId?: string;
  packageName?: string;
  category?: string;
  eventName?: string;
  eventDate?: string;
  venue?: string;
  city?: string;
  guestCount?: number;
}

const KEY = 'joinevents_checkout';

export function saveCheckoutDraft(draft: CheckoutDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable (private mode); checkout also receives the draft in router state.
  }
}

export function loadCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
