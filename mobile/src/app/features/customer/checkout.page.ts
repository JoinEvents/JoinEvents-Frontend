import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonRadio, IonRadioGroup, IonSpinner, NavController
} from '@ionic/angular/standalone';

import { BookingService } from '../../core/services/booking.service';
import { PaymentService } from '../../core/services/payment.service';
import { ToastService } from '../../core/services/toast.service';
import { CheckoutDraft, CheckoutDraftService } from '../../core/services/checkout-draft.service';
import { Booking, BookingQuoteLine } from '../../core/models/booking.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

interface PaymentMethod {
  id: string;
  label: string;
  description: string;
  icon: string;
}

/** Everything checkout shows, taken from the server: a fresh quote, or the booking itself. */
interface CheckoutSummary {
  packageName: string;
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

/**
 * Checkout. For a new booking it prices the customer's choice on the server, then creates the
 * booking only when they pay, so an abandoned checkout never holds the vendor's date. For an
 * existing booking it loads it and pays whatever is still due. The customer pays the advance or
 * the full amount; the server decides and charges the amount.
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    DatePipe, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonRadio, IonRadioGroup, IonSpinner
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/bookings" text="" />
        </ion-buttons>
        <ion-title>Checkout</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent" /></div>
      } @else if (summary(); as s) {
        <div class="je-section">
          <!-- Booking summary -------------------------------------------- -->
          <div class="je-card">
            @if (s.eventName && s.eventName !== s.packageName) {
              <span class="je-xs je-soft">{{ s.packageName }}</span>
            }
            <h2 class="bk-title">{{ s.eventName || s.packageName }}</h2>
            <p class="je-sm je-muted meta">
              <ion-icon name="calendar-outline" /> {{ s.eventDate | date: 'EEE, d MMM y' }}
            </p>
            @if (s.venue || s.city) {
              <p class="je-sm je-muted meta">
                <ion-icon name="location-outline" /> {{ place(s) }}
              </p>
            }
            @if (s.guestCount) {
              <p class="je-sm je-muted meta">
                <ion-icon name="people-outline" /> {{ s.guestCount }} guests
              </p>
            }
          </div>

          <!-- Amount: each whole row is the radio, so tapping anywhere on it selects it ----- -->
          @if (canChooseSplit()) {
            <div class="je-section-head"><h2>How much to pay now</h2></div>
            <div class="je-card je-card--flush">
            <ion-radio-group [value]="split()" (ionChange)="onSplit($event)">
              <ion-item lines="full" class="opt" [class.opt--on]="split() === 'advance'">
                <ion-radio value="advance" labelPlacement="start" justify="space-between">
                  <span class="opt__label">
                    <span class="opt__text">
                      <strong class="je-sm">Advance ({{ s.advancePercent }}%)</strong>
                      <span class="je-xs je-muted">Balance of {{ (s.totalAmount - s.advanceAmount) | inr }} due later</span>
                    </span>
                    <strong class="je-sm opt__amt">{{ s.advanceAmount | inr }}</strong>
                  </span>
                </ion-radio>
              </ion-item>
              <ion-item lines="none" class="opt" [class.opt--on]="split() === 'full'">
                <ion-radio value="full" labelPlacement="start" justify="space-between">
                  <span class="opt__label">
                    <span class="opt__text">
                      <strong class="je-sm">Full amount</strong>
                      <span class="je-xs je-muted">Nothing left to pay later</span>
                    </span>
                    <strong class="je-sm opt__amt">{{ s.totalAmount | inr }}</strong>
                  </span>
                </ion-radio>
              </ion-item>
            </ion-radio-group>
            </div>
          }

          <!-- Payment method ---------------------------------------------------- -->
          <div class="je-section-head"><h2>Pay with</h2></div>
          <div class="je-card je-card--flush">
          <ion-radio-group [value]="method()" (ionChange)="onMethod($event)">
            @for (option of methods; track option.id; let last = $last) {
              <ion-item [lines]="last ? 'none' : 'full'" class="opt" [class.opt--on]="method() === option.id">
                <ion-radio [value]="option.id" labelPlacement="start" justify="space-between">
                  <span class="opt__label">
                    <ion-icon [name]="option.icon" color="primary" class="opt__icon" />
                    <span class="opt__text">
                      <strong class="je-sm">{{ option.label }}</strong>
                      <span class="je-xs je-muted">{{ option.description }}</span>
                    </span>
                  </span>
                </ion-radio>
              </ion-item>
            }
          </ion-radio-group>
          </div>

          <!-- Totals (from the server) --------------------------------------- -->
          <div class="je-section-head"><h2>Payment summary</h2></div>
          <div class="je-card">
            @for (line of s.lines; track $index) {
              <div class="line">
                <span class="je-sm je-muted">
                  {{ line.description }}
                  @if (line.detail) { <span class="je-xs je-soft detail">{{ line.detail }}</span> }
                </span>
                <span class="je-sm">{{ line.amount | inr }}</span>
              </div>
            }
            @if (s.gstAmount !== undefined) {
              <div class="line">
                <span class="je-sm je-muted">GST ({{ s.gstPercent }}%)</span>
                <span class="je-sm">{{ s.gstAmount | inr }}</span>
              </div>
            }
            <div class="line line--total">
              <strong>Total</strong>
              <strong class="je-sm">{{ s.totalAmount | inr }}</strong>
            </div>
            @if (s.amountPaid > 0) {
              <div class="line">
                <span class="je-sm je-muted">Already paid</span>
                <span class="je-sm paid">−{{ s.amountPaid | inr }}</span>
              </div>
            }
            <div class="line line--due">
              <strong>Due now</strong>
              <strong class="je-price">{{ payable() | inr }}</strong>
            </div>
            <p class="je-xs je-soft note">
              <ion-icon name="lock-closed" />
              Held in escrow and released to the vendor after your event.
            </p>
          </div>
        </div>

        <div class="je-action-bar">
          <ion-button expand="block" class="je-btn-gradient pay" (click)="pay()"
                      [disabled]="paying() || payable() <= 0">
            @if (paying()) { <ion-spinner name="crescent" /> } @else { Pay {{ payable() | inr }} }
          </ion-button>
        </div>
      } @else {
        <div class="je-empty">
          <ion-icon name="alert-circle-outline" />
          <h3>Nothing to pay</h3>
          <p>{{ problem() || 'Choose a package and its details first.' }}</p>
          <ion-button fill="outline" (click)="nav.navigateRoot('/customer/tabs/events')">Browse packages</ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }
    .bk-title { font-size: var(--je-fs-md); margin: 6px 0 12px; }
    .meta { display: flex; align-items: center; gap: 7px; margin: 0 0 6px; }
    .opt { --background: transparent; --padding-start: 14px; --inner-padding-end: 14px; }
    .opt--on { --background: rgba(255, 107, 53, 0.08); }
    .opt ion-radio { width: 100%; }
    .opt ion-radio::part(label) { flex: 1; margin-right: 12px; white-space: normal; overflow: visible; }
    .opt__label { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 0; }
    .opt__text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .opt__icon { font-size: 22px; flex-shrink: 0; }
    .opt__amt { flex-shrink: 0; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 0; }
    .line--total { margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .line--due { padding: 10px 12px; margin-top: 8px; border-radius: var(--je-radius-sm);
                 background: rgba(255, 107, 53, 0.08); color: var(--je-primary); }
    .detail { display: block; }
    .paid { color: var(--je-success); font-weight: 600; }
    .note { display: flex; align-items: center; gap: 6px; margin: 12px 0 0; }
    .pay { margin: 0; width: 100%; }
  `]
})
export class CheckoutPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private paymentService = inject(PaymentService);
  private toast = inject(ToastService);
  private drafts = inject(CheckoutDraftService);
  readonly nav = inject(NavController);

  readonly methods: PaymentMethod[] = [
    { id: 'upi', label: 'UPI', description: 'Google Pay, PhonePe, Paytm and more', icon: 'phone-portrait-outline' },
    { id: 'card', label: 'Card', description: 'Credit or debit card', icon: 'card-outline' },
    { id: 'netbanking', label: 'Net banking', description: 'All major Indian banks', icon: 'business-outline' },
    { id: 'wallet', label: 'Wallet', description: 'Paytm, Amazon Pay and others', icon: 'wallet-outline' }
  ];

  readonly loading = signal(true);
  readonly paying = signal(false);
  readonly summary = signal<CheckoutSummary | null>(null);
  readonly problem = signal('');
  readonly method = signal('upi');
  readonly split = signal<'advance' | 'full'>('advance');

  /** Set once the booking exists: an existing one, or one created by a first payment attempt. */
  private bookingId: string | null = null;
  private draft: CheckoutDraft | null = null;

  /** Advance or full can be chosen only while nothing has been paid. */
  readonly canChooseSplit = computed(() => {
    const s = this.summary();
    return !!s && s.amountPaid === 0 && s.advanceAmount > 0 && s.advanceAmount < s.totalAmount;
  });

  readonly payable = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    if (!this.canChooseSplit()) return s.balanceDue;
    return this.split() === 'advance' ? s.advanceAmount : s.totalAmount;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('bookingId');
    if (id && id !== 'new') {
      this.loadBooking(id);
      return;
    }
    this.draft = this.drafts.get();
    if (!this.draft) {
      this.loading.set(false);
      return;
    }
    this.loadQuote(this.draft);
  }

  onSplit(event: Event): void {
    const value = (event as CustomEvent<{ value: 'advance' | 'full' }>).detail.value;
    if (value === 'advance' || value === 'full') this.split.set(value);
  }

  onMethod(event: Event): void {
    const value = (event as CustomEvent<{ value: string }>).detail.value;
    if (this.methods.some(m => m.id === value)) this.method.set(value);
  }

  place(s: CheckoutSummary): string {
    if (!s.venue) return s.city ?? '';
    return s.city && !s.venue.includes(s.city) ? `${s.venue}, ${s.city}` : s.venue;
  }

  /** Prices a new booking on the server from what the customer chose. */
  private loadQuote(draft: CheckoutDraft): void {
    this.bookingService.quote(draft.packageId, draft.guestCount).subscribe(result => {
      this.loading.set(false);
      if (!result.ok) {
        this.problem.set(result.error);
        return;
      }
      const q = result.value;
      this.summary.set({
        packageName: q.packageName || draft.packageName,
        eventName: draft.eventName,
        eventDate: draft.eventDate,
        venue: draft.venue,
        city: draft.city,
        guestCount: q.guestCount,
        lines: q.lines,
        gstPercent: q.gstPercent,
        gstAmount: q.gstAmount,
        totalAmount: q.totalAmount,
        advancePercent: q.advancePercent,
        advanceAmount: q.advanceAmount,
        amountPaid: 0,
        balanceDue: q.totalAmount
      });
    });
  }

  /** Loads an existing booking to pay what is still due on it. */
  private loadBooking(id: string): void {
    this.bookingService.fetch(id).subscribe(result => {
      this.loading.set(false);
      if (!result.ok) {
        this.problem.set(result.error);
        return;
      }
      const b = result.value;
      if (['cancelled', 'rejected'].includes(b.status)) {
        this.problem.set('This booking is no longer payable.');
        return;
      }
      this.bookingId = b.id;
      const summary = this.fromBooking(b);
      if (summary.balanceDue <= 0) {
        this.problem.set('This booking is already fully paid.');
        return;
      }
      this.summary.set(summary);
    });
  }

  private fromBooking(b: Booking): CheckoutSummary {
    const total = b.totalAmount ?? 0;
    const paid = b.amountPaid ?? (b.status === 'pending' ? 0 : b.advanceAmount ?? 0);
    return {
      packageName: b.packageName || b.eventName,
      eventName: b.eventName,
      eventDate: b.eventDate,
      venue: b.venue,
      city: b.city,
      guestCount: b.guestCount,
      lines: (b.services ?? []).map(s => ({ description: s.serviceName, amount: s.price })),
      totalAmount: total,
      advancePercent: total > 0 ? Math.round(((b.advanceAmount ?? 0) / total) * 100) : 0,
      advanceAmount: b.advanceAmount ?? 0,
      amountPaid: paid,
      balanceDue: b.balanceDue ?? Math.max(0, total - paid)
    };
  }

  pay(): void {
    if (this.paying() || this.payable() <= 0) return;
    this.paying.set(true);

    if (this.bookingId) {
      this.charge(this.bookingId);
      return;
    }

    const draft = this.draft;
    if (!draft) {
      this.paying.set(false);
      return;
    }
    this.bookingService.create({
      packageId: draft.packageId,
      vendorId: draft.vendorId,
      eventDate: draft.eventDate,
      guestCount: draft.guestCount,
      eventName: draft.eventName,
      venue: draft.venue,
      city: draft.city
    }).subscribe(result => {
      if (!result.ok) {
        this.paying.set(false);
        void this.toast.error(result.error);
        return;
      }
      // From here on a retry pays this booking instead of creating another.
      this.bookingId = result.value.id;
      this.drafts.clear();
      this.charge(result.value.id);
    });
  }

  private charge(bookingId: string): void {
    const payInFull = this.canChooseSplit() && this.split() === 'full';
    this.paymentService.start(bookingId, this.method(), payInFull).subscribe(async started => {
      if (!started.ok) {
        this.paying.set(false);
        void this.toast.error(started.error);
        return;
      }

      if (started.value.checkoutUrl) {
        // Hosted gateway page — opens outside the app's own WebView; the booking shows the outcome.
        this.paying.set(false);
        await this.paymentService.openCheckout(started.value.checkoutUrl);
        void this.router.navigate(['/customer/booking', bookingId], { replaceUrl: true });
        return;
      }

      this.paymentService.verify(started.value.providerRef).subscribe(verified => {
        this.paying.set(false);
        if (!verified.ok) {
          void this.toast.error(verified.error);
          return;
        }
        if (verified.value.status !== 'Succeeded') {
          void this.toast.error('The payment was not completed. You have not been charged; please try again.');
          return;
        }
        void this.toast.success(`Payment of ₹${started.value.amount.toLocaleString('en-IN')} received.`);
        void this.router.navigate(['/customer/booking', bookingId], { replaceUrl: true });
      });
    });
  }
}
