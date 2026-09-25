import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { GuaranteeService } from '../../core/services/guarantee.service';
import { Booking, BookingQuoteLine } from '../../core/models/booking.model';
import { environment } from '../../../environments/environment';
import { CheckoutDraft, clearCheckoutDraft, loadCheckoutDraft, saveCheckoutDraft } from './checkout-draft';

/** Everything checkout shows, taken from the server: a fresh quote, or the booking itself. */
interface CheckoutSummary {
  bookingId?: string;
  packageName: string;
  category?: string;
  eventName?: string;
  eventDate: string;
  venue?: string;
  city?: string;
  guestCount?: number;
  lines: BookingQuoteLine[];
  gstPercent?: number;
  gstAmount?: number;
  totalAmount: number;
  advancePercent: number;
  advanceAmount: number;
  amountPaid: number;
  balanceDue: number;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class Checkout implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private paymentService = inject(PaymentService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private guaranteeService = inject(GuaranteeService);

  guaranteeHighlights = this.guaranteeService.getGuaranteeHighlights();

  /** What the customer chose on the package page (no prices). */
  private draft: CheckoutDraft | null = null;
  summary = signal<CheckoutSummary | null>(null);

  // UI state
  paymentType = signal<'advance' | 'full'>('advance');
  paymentMethod = signal<'card' | 'upi' | 'netbanking'>('card');
  isProcessing = signal(false);
  checkoutSuccess = signal(false);
  errorMessage = signal('');
  processingStep = signal(''); // 'loading', 'creating', 'initiating', 'verifying'

  // Card form
  cardNumber = signal('');
  cardHolder = signal('');
  cardExpiry = signal('');
  cardCvv = signal('');

  // UPI
  upiId = signal('');

  // Net banking
  selectedBank = signal('');
  readonly banks = [
    { id: 'hdfc', name: 'HDFC Bank', logo: 'bi-bank' },
    { id: 'icici', name: 'ICICI Bank', logo: 'bi-bank2' },
    { id: 'sbi', name: 'State Bank of India', logo: 'bi-building-columns' },
    { id: 'axis', name: 'Axis Bank', logo: 'bi-bank' },
    { id: 'kotak', name: 'Kotak Mahindra Bank', logo: 'bi-bank' },
    { id: 'pnb', name: 'Punjab National Bank', logo: 'bi-bank2' },
    { id: 'bob', name: 'Bank of Baroda', logo: 'bi-bank' }
  ];

  /** The customer can choose advance or full only while nothing has been paid yet. */
  canChooseSplit = computed(() => {
    const s = this.summary();
    return !!s && s.amountPaid === 0 && s.advanceAmount > 0 && s.advanceAmount < s.totalAmount;
  });

  payableAmount = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    if (!this.canChooseSplit()) return s.balanceDue;
    return this.paymentType() === 'advance' ? s.advanceAmount : s.totalAmount;
  });

  /** What the server actually charged, once the payment has gone through. */
  paidAmount = signal(0);

  isCardValid = computed(() => {
    const num = this.cardNumber().replace(/\s+/g, '');
    return num.length >= 15 && this.cardHolder().trim().length > 2
      && /^\d{2}\/\d{2}$/.test(this.cardExpiry()) && this.cardCvv().length >= 3;
  });

  transactionId = signal('');
  paymentProviderRef = signal('');
  bookingId = signal<string | null>(null);

  readonly isDev = !environment.production;

  /** Rupees in Indian digit grouping (₹2,00,600), as on the package page. */
  inr(amount: number | null | undefined): string {
    return (amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  ngOnInit() {
    const routeId = this.route.snapshot.paramMap.get('packageId');
    const state = history.state ?? {};
    const fromState: CheckoutDraft | null =
      state.checkout ?? (state.bookingId ? { bookingId: state.bookingId } : null);

    this.draft = fromState ?? loadCheckoutDraft();

    if (this.draft?.bookingId) {
      this.loadBooking(this.draft.bookingId);
    } else if (this.draft?.packageId && (!routeId || this.draft.packageId === routeId)) {
      this.loadQuote(this.draft);
    } else if (routeId) {
      // Opened directly: an existing booking can be paid; a package needs its details chosen first.
      this.loadBooking(routeId, () => this.router.navigate(['/book', routeId]));
    } else {
      this.errorMessage.set('No booking details found. Please choose a package first.');
    }
  }

  /** Prices a new booking on the server from what the customer chose. */
  private loadQuote(draft: CheckoutDraft) {
    if (!draft.packageId || !draft.guestCount || !draft.eventDate) {
      this.router.navigate(['/book', draft.packageId]);
      return;
    }
    this.processingStep.set('loading');
    this.isProcessing.set(true);
    this.bookingService.getQuote(draft.packageId, draft.guestCount).subscribe({
      next: quote => {
        this.isProcessing.set(false);
        this.summary.set({
          packageName: quote.packageName || draft.packageName || '',
          category: draft.category,
          eventName: draft.eventName,
          eventDate: draft.eventDate!,
          venue: draft.venue,
          city: draft.city,
          guestCount: quote.guestCount,
          lines: quote.lines,
          gstPercent: quote.gstPercent,
          gstAmount: quote.gstAmount,
          totalAmount: quote.totalAmount,
          advancePercent: quote.advancePercent,
          advanceAmount: quote.advanceAmount,
          amountPaid: 0,
          balanceDue: quote.totalAmount
        });
      },
      error: err => {
        this.isProcessing.set(false);
        this.setErrorMessage(this.reason(err) || 'Could not price this booking. Please go back and try again.');
      }
    });
  }

  /** Loads an existing booking to pay what is still due on it. */
  private loadBooking(bookingId: string, onNotFound?: () => void) {
    this.processingStep.set('loading');
    this.isProcessing.set(true);
    this.bookingService.getBookingById(bookingId).subscribe({
      next: booking => {
        this.isProcessing.set(false);
        this.bookingId.set(booking.id);
        this.summary.set(this.fromBooking(booking));
        if (this.isSettledOrClosed(booking)) {
          this.setErrorMessage(booking.status === 'cancelled'
            ? 'This booking has been cancelled.'
            : 'This booking is already fully paid.');
        }
      },
      error: err => {
        this.isProcessing.set(false);
        if (onNotFound && (err?.status === 404 || err?.status === 400)) {
          onNotFound();
          return;
        }
        this.setErrorMessage(this.reason(err) || 'Could not load this booking.');
      }
    });
  }

  private fromBooking(b: Booking): CheckoutSummary {
    const total = b.totalAmount || 0;
    const paid = b.amountPaid ?? (b.status === 'pending' ? 0 : b.advanceAmount || 0);
    return {
      bookingId: b.id,
      packageName: b.packageName || b.eventName,
      category: b.eventTypeId,
      eventName: b.eventName,
      eventDate: b.eventDate,
      venue: b.venue,
      city: b.city,
      guestCount: b.guestCount,
      lines: (b.services || []).map(s => ({ description: s.serviceName, amount: s.price })),
      totalAmount: total,
      advancePercent: total > 0 ? Math.round((b.advanceAmount / total) * 100) : 0,
      advanceAmount: b.advanceAmount || 0,
      amountPaid: paid,
      balanceDue: b.balanceDue ?? Math.max(0, total - paid)
    };
  }

  private isSettledOrClosed(b: Booking): boolean {
    return b.status === 'cancelled' || b.status === 'rejected' || (b.balanceDue ?? 1) <= 0;
  }

  onCardNumberInput(event: any) {
    const input = event.target.value.replace(/\D/g, '').substring(0, 16);
    this.cardNumber.set(input.replace(/(\d{4})(?=\d)/g, '$1 '));
  }

  onCardExpiryInput(event: any) {
    let input = event.target.value.replace(/\D/g, '').substring(0, 4);
    if (input.length > 2) input = input.substring(0, 2) + '/' + input.substring(2);
    this.cardExpiry.set(input);
  }

  onCardCvvInput(event: any) {
    this.cardCvv.set(event.target.value.replace(/\D/g, '').substring(0, 4));
  }

  /** Fills a gateway test card; only offered outside production. */
  autofillCardDetails() {
    if (this.isDev) {
      this.cardHolder.set('Test Customer');
      this.cardNumber.set('4111 1111 1111 1111');
      this.cardExpiry.set('12/29');
      this.cardCvv.set('123');
    }
  }

  /** The server's reason for a refusal; a server fault ("Internal Server Error") gets a plain retry message. */
  private reason(err: any): string {
    if (err?.status === 0) return 'Could not reach the server. Check your connection and try again.';
    if (err?.status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
    return err?.error?.error || '';
  }

  setErrorMessage(msg: string) {
    this.errorMessage.set(msg);
    if (msg) this.toast.error(msg);
  }

  payAndConfirm() {
    this.errorMessage.set('');

    if (this.paymentMethod() === 'card' && !this.isCardValid()) {
      this.setErrorMessage('Please fill all card details correctly.');
      return;
    }
    if (this.paymentMethod() === 'upi' && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(this.upiId().trim())) {
      this.setErrorMessage('Please enter a valid UPI ID (e.g. name@okaxis).');
      return;
    }
    if (this.paymentMethod() === 'netbanking' && !this.selectedBank()) {
      this.setErrorMessage('Please select your bank.');
      return;
    }
    if (!this.auth.currentUser()) {
      this.setErrorMessage('Your session has expired. Please log in again.');
      return;
    }
    if (!this.summary() || this.payableAmount() <= 0) return;

    this.isProcessing.set(true);

    const existing = this.bookingId();
    if (existing) {
      this.pay(existing);
      return;
    }

    // A new booking is created only when the customer pays, so an abandoned checkout never
    // holds the vendor's date.
    const draft = this.draft!;
    this.processingStep.set('creating');
    this.bookingService.createBooking({
      packageId: draft.packageId!,
      vendorId: draft.vendorId,
      eventDate: draft.eventDate!,
      guestCount: draft.guestCount!,
      eventName: draft.eventName,
      venue: draft.venue,
      city: draft.city
    }).subscribe({
      next: booking => {
        this.bookingId.set(booking.id);
        // A retry after a failed payment pays this booking instead of creating another.
        this.draft = { ...draft, bookingId: booking.id };
        saveCheckoutDraft(this.draft);
        this.summary.update(s => s ? { ...s, bookingId: booking.id, totalAmount: booking.totalAmount, advanceAmount: booking.advanceAmount } : s);
        this.pay(booking.id);
      },
      error: err => {
        this.isProcessing.set(false);
        this.setErrorMessage(this.reason(err) || 'Failed to create the booking.');
      }
    });
  }

  private pay(bookingId: string) {
    this.processingStep.set('initiating');
    const payInFull = this.canChooseSplit() && this.paymentType() === 'full';

    this.paymentService.initiatePayment({
      bookingId,
      paymentMethod: this.paymentMethod().toUpperCase(),
      payInFull
    }).subscribe({
      next: initiation => {
        this.paymentProviderRef.set(initiation.providerRef);
        this.transactionId.set(initiation.paymentId);
        this.processingStep.set('verifying');

        this.paymentService.confirmPayment(initiation.providerRef).subscribe({
          next: result => {
            this.isProcessing.set(false);
            if (result?.status && result.status !== 'Succeeded') {
              this.setErrorMessage('The payment was not completed. You have not been charged; please try again.');
              return;
            }
            this.paidAmount.set(initiation.amount);
            this.checkoutSuccess.set(true);
            clearCheckoutDraft();
          },
          error: err => {
            this.isProcessing.set(false);
            this.setErrorMessage(this.reason(err) || 'Failed to confirm the payment. Check My Bookings for its status.');
          }
        });
      },
      error: err => {
        this.isProcessing.set(false);
        this.setErrorMessage(this.reason(err) || 'Failed to start the payment.');
      }
    });
  }
}
