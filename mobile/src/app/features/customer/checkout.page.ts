import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonInput, IonRadio, IonRadioGroup, IonSpinner, IonLabel
} from '@ionic/angular/standalone';

import { BookingService } from '../../core/services/booking.service';
import { PaymentService } from '../../core/services/payment.service';
import { LoyaltyService } from '../../core/services/loyalty.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { Booking } from '../../core/models/booking.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

interface PaymentMethod {
  id: string;
  label: string;
  description: string;
  icon: string;
}

/**
 * Checkout. Applies reward points and a coupon, then hands off to the payment
 * gateway's hosted page in an in-app browser tab — the app never sees card
 * details, which keeps it out of PCI scope.
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    DatePipe, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonInput, IonRadio, IonRadioGroup, IonSpinner, IonLabel
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
      } @else if (booking(); as b) {
        <div class="je-section">
          <!-- Booking summary -------------------------------------------- -->
          <div class="je-card">
            <span class="je-xs je-soft">Booking {{ b.bookingNumber || b.id.slice(0, 8) }}</span>
            <h2 class="bk-title">{{ b.eventName }}</h2>
            <p class="je-sm je-muted meta">
              <ion-icon name="calendar-outline" /> {{ b.eventDate | date: 'EEE, d MMM y' }}
            </p>
            <p class="je-sm je-muted meta">
              <ion-icon name="location-outline" /> {{ b.venue }}, {{ b.city }}
            </p>
            <p class="je-sm je-muted meta">
              <ion-icon name="people-outline" /> {{ b.guestCount }} guests
            </p>
          </div>

          <!-- Reward points ------------------------------------------------ -->
          @if (availablePoints() > 0) {
            <div class="je-section-head"><h2>Reward points</h2></div>
            <div class="je-card points">
              <div class="points__head">
                <div>
                  <strong class="je-sm">You have {{ availablePoints() }} points</strong>
                  <p class="je-xs je-muted">100 points = ₹100 off</p>
                </div>
                <ion-button size="small" [fill]="pointsApplied() ? 'solid' : 'outline'"
                            (click)="togglePoints()">
                  {{ pointsApplied() ? 'Applied' : 'Apply' }}
                </ion-button>
              </div>
            </div>
          }

          <!-- Coupon --------------------------------------------------------- -->
          <div class="je-section-head"><h2>Coupon</h2></div>
          <ion-item class="je-field" lines="none">
            <ion-icon name="pricetag-outline" slot="start" color="medium" />
            <ion-input [value]="coupon()" placeholder="Enter a coupon code"
                       (ionInput)="coupon.set($any($event.target).value)" />
          </ion-item>

          <!-- Payment method --------------------------------------------------- -->
          <div class="je-section-head"><h2>Pay with</h2></div>
          <div class="je-card je-card--flush">
            <ion-radio-group [value]="method()" (ionChange)="method.set($any($event.detail.value))">
              @for (option of methods; track option.id) {
                <ion-item lines="full" class="method">
                  <ion-icon [name]="option.icon" slot="start" color="primary" />
                  <ion-label>
                    <strong class="je-sm">{{ option.label }}</strong>
                    <p class="je-xs je-muted">{{ option.description }}</p>
                  </ion-label>
                  <ion-radio slot="end" [value]="option.id" />
                </ion-item>
              }
            </ion-radio-group>
          </div>

          <!-- Totals --------------------------------------------------------- -->
          <div class="je-section-head"><h2>Payment summary</h2></div>
          <div class="je-card">
            <div class="line">
              <span class="je-sm je-muted">Booking total</span>
              <span class="je-sm">{{ b.totalAmount | inr }}</span>
            </div>
            @if (pointsDiscount() > 0) {
              <div class="line">
                <span class="je-sm je-muted">Reward points</span>
                <span class="je-sm discount">−{{ pointsDiscount() | inr }}</span>
              </div>
            }
            <div class="line line--total">
              <strong>Due now (advance)</strong>
              <strong class="je-price">{{ payableNow() | inr }}</strong>
            </div>
            <p class="je-xs je-soft note">
              <ion-icon name="lock-closed" />
              Held in escrow and released to the vendor after your event.
            </p>
          </div>
        </div>

        <div class="je-action-bar">
          <ion-button expand="block" class="je-btn-gradient pay" (click)="pay()" [disabled]="paying()">
            @if (paying()) { <ion-spinner name="crescent" /> } @else { Pay {{ payableNow() | inr }} }
          </ion-button>
        </div>
      } @else {
        <div class="je-empty">
          <ion-icon name="alert-circle-outline" />
          <h3>Booking not found</h3>
          <p>This booking may have been cancelled.</p>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }
    .bk-title { font-size: var(--je-fs-md); margin: 6px 0 12px; }
    .meta { display: flex; align-items: center; gap: 7px; margin: 0 0 6px; }
    .points__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .points__head p { margin: 3px 0 0; }
    .method { --background: transparent; --padding-start: 14px; }
    .method p { margin: 2px 0 0; }
    .line { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; }
    .line--total { margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .discount { color: var(--je-success); font-weight: 600; }
    .note { display: flex; align-items: center; gap: 6px; margin: 12px 0 0; }
    .pay { margin: 0; width: 100%; }
  `]
})
export class CheckoutPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private paymentService = inject(PaymentService);
  private loyalty = inject(LoyaltyService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  readonly methods: PaymentMethod[] = [
    { id: 'upi', label: 'UPI', description: 'Google Pay, PhonePe, Paytm and more', icon: 'phone-portrait-outline' },
    { id: 'card', label: 'Card', description: 'Credit or debit card', icon: 'card-outline' },
    { id: 'netbanking', label: 'Net banking', description: 'All major Indian banks', icon: 'business-outline' },
    { id: 'wallet', label: 'Wallet', description: 'Paytm, Amazon Pay and others', icon: 'wallet-outline' }
  ];

  readonly loading = signal(true);
  readonly paying = signal(false);
  readonly booking = signal<Booking | null>(null);
  readonly method = signal('upi');
  readonly coupon = signal('');
  readonly availablePoints = signal(0);
  readonly pointsApplied = signal(false);

  readonly pointsDiscount = computed(() => (this.pointsApplied() ? this.availablePoints() : 0));
  readonly payableNow = computed(() => {
    const advance = this.booking()?.advanceAmount ?? 0;
    return Math.max(0, advance - this.pointsDiscount());
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('bookingId');
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.bookingService.getById(id).subscribe(booking => {
      this.booking.set(booking);
      this.loading.set(false);
    });

    const userId = this.auth.currentUser()?.id;
    if (userId) {
      this.loyalty.getBalance(userId).subscribe(balance => this.availablePoints.set(balance?.points ?? 0));
    }
  }

  togglePoints(): void {
    this.pointsApplied.update(applied => !applied);
  }

  pay(): void {
    const booking = this.booking();
    if (!booking) return;

    this.paying.set(true);
    this.paymentService
      .initiate({
        bookingId: booking.id,
        paymentMethod: this.method(),
        couponCode: this.coupon().trim() || undefined
      })
      .subscribe(async intent => {
        this.paying.set(false);
        if (!intent) {
          void this.toast.error('Payment could not be started. Please try again.');
          return;
        }

        if (intent.checkoutUrl) {
          // Hosted gateway page — opens outside the app's own WebView.
          await this.paymentService.openCheckout(intent.checkoutUrl);
          void this.router.navigate(['/customer/booking', booking.id], { replaceUrl: true });
          return;
        }

        // No redirect needed: the gateway settled server-side.
        this.paymentService.confirm(intent.providerRef, 'success').subscribe(confirmed => {
          if (!confirmed) {
            void this.toast.error('We could not confirm the payment. Check Payments for the status.');
            return;
          }
          void this.toast.success('Payment received. Your booking is confirmed.');
          void this.router.navigate(['/customer/booking', booking.id], { replaceUrl: true });
        });
      });
  }
}
