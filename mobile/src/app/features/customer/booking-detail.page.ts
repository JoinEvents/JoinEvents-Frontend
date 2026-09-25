import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonSpinner, IonModal, IonTextarea, IonItem
} from '@ionic/angular/standalone';

import { BookingService, CancellationBreakdown } from '../../core/services/booking.service';
import { ReviewService } from '../../core/services/review.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { Booking } from '../../core/models/booking.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

/**
 * A single booking: timeline, itemised services, money, and the actions
 * available in its current state (pay balance, review, cancel, dispute).
 */
@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [
    DatePipe, CurrencyInrPipe, StatusPillComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonSpinner, IonModal, IonTextarea, IonItem
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/bookings" text="" />
        </ion-buttons>
        <ion-title>Booking</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="share()"><ion-icon slot="icon-only" name="share-social-outline" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent" /></div>
      } @else if (booking(); as b) {
        <div class="je-section">
          <!-- Header --------------------------------------------------- -->
          <div class="je-card head">
            <div class="head__top">
              <span class="je-xs je-soft">{{ b.bookingNumber || b.id.slice(0, 8) }}</span>
              <app-status-pill [status]="b.status" />
            </div>
            <h1>{{ b.eventName }}</h1>
            <p class="meta"><ion-icon name="calendar-outline" /> {{ b.eventDate | date: 'EEEE, d MMMM y' }}</p>
            <p class="meta"><ion-icon name="location-outline" /> {{ b.venue }}, {{ b.city }}</p>
            <p class="meta"><ion-icon name="people-outline" /> {{ b.guestCount }} guests</p>
          </div>

          <!-- Progress ------------------------------------------------- -->
          <div class="je-section-head"><h2>Progress</h2></div>
          <div class="je-card">
            @for (step of timeline(); track step.key) {
              <div class="step" [class.step--done]="step.done" [class.step--current]="step.current">
                <span class="step__dot">
                  @if (step.done) { <ion-icon name="checkmark" /> }
                </span>
                <div class="step__body">
                  <strong class="je-sm">{{ step.label }}</strong>
                  <span class="je-xs je-muted">{{ step.hint }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Vendor --------------------------------------------------- -->
          @if (b.vendorName) {
            <div class="je-section-head"><h2>Vendor</h2></div>
            <div class="je-card vendor">
              <div class="vendor__avatar">{{ initials(b.vendorName) }}</div>
              <div class="vendor__body">
                <strong class="je-sm">{{ b.vendorName }}</strong>
                @if (b.vendorLocation) { <span class="je-xs je-muted">{{ b.vendorLocation }}</span> }
              </div>
              @if (b.vendorPhone) {
                <ion-button size="small" fill="outline" [href]="'tel:' + b.vendorPhone">
                  <ion-icon slot="icon-only" name="call-outline" />
                </ion-button>
              }
            </div>
          }

          <!-- Services --------------------------------------------------- -->
          @if (b.services.length) {
            <div class="je-section-head"><h2>Services</h2></div>
            <div class="je-card">
              @for (service of b.services; track service.serviceId) {
                <div class="svc">
                  <div class="svc__body">
                    <strong class="je-sm je-truncate">{{ service.serviceName }}</strong>
                    <span class="je-xs je-muted">{{ service.vendorName }}</span>
                  </div>
                  <div class="svc__end">
                    <span class="je-sm">{{ service.price | inr }}</span>
                    <app-status-pill [status]="service.status" />
                  </div>
                </div>
              }
            </div>
          }

          <!-- Money ------------------------------------------------------- -->
          <div class="je-section-head"><h2>Payment</h2></div>
          <div class="je-card">
            @for (item of b.services; track item.serviceId) {
              <div class="line"><span class="je-sm je-muted">{{ item.serviceName }}</span><span class="je-sm">{{ item.price | inr }}</span></div>
            } @empty {
              <div class="line"><span class="je-sm je-muted">Package (before GST)</span><span class="je-sm">{{ b.baseAmount | inr }}</span></div>
            }
            @if (b.extraServicesAmount) {
              <div class="line"><span class="je-sm je-muted">Extra services</span><span class="je-sm">{{ b.extraServicesAmount | inr }}</span></div>
            }
            @if (b.damageCharges) {
              <div class="line"><span class="je-sm je-muted">Damage charges</span><span class="je-sm">{{ b.damageCharges | inr }}</span></div>
            }
            <div class="line"><span class="je-sm je-muted">GST ({{ b.gstPercent }}%)</span>
              <span class="je-sm">{{ gst(b) | inr }}</span></div>
            <div class="line line--total"><strong>Total</strong><strong class="je-price">{{ b.totalAmount | inr }}</strong></div>
            <div class="line"><span class="je-sm je-muted">Paid so far</span>
              <span class="je-sm">{{ paid(b) | inr }}</span></div>
            @if (balanceDue(b) > 0) {
              <div class="line"><span class="je-sm je-bold">Balance due</span>
                <span class="je-sm je-bold">{{ balanceDue(b) | inr }}</span></div>
            }
            @if (b.escrowStatus) {
              <p class="je-xs je-soft note">
                <ion-icon name="lock-closed" /> Escrow: {{ b.escrowStatus }}
              </p>
            }
          </div>

          <!-- Cancellation / refund ---------------------------------------- -->
          @if (b.status === 'cancelled') {
            <div class="je-section-head"><h2>Cancellation</h2></div>
            <div class="je-card">
              @if (b.cancellationReason) { <p class="je-sm je-muted">{{ b.cancellationReason }}</p> }
              <div class="line"><span class="je-sm je-muted">Cancellation fee</span>
                <span class="je-sm">{{ b.cancellationFee | inr }}</span></div>
              <div class="line"><span class="je-sm je-muted">Refund</span>
                <span class="je-sm">{{ b.refundAmount | inr }}</span></div>
              @if (b.refundStatus) {
                <div class="line"><span class="je-sm je-muted">Refund status</span>
                  <app-status-pill [status]="b.refundStatus" /></div>
              }
            </div>
          }

          <!-- Actions ----------------------------------------------------- -->
          <div class="je-section-head"><h2>Actions</h2></div>
          <div class="acts">
            @if (canPay(b)) {
              <ion-button expand="block" class="je-btn-gradient" (click)="payBalance(b)">
                @if (paid(b) === 0) { Pay now } @else { Pay balance {{ balanceDue(b) | inr }} }
              </ion-button>
            }
            @if (b.status === 'completed' && !b.review) {
              <ion-button expand="block" fill="outline" (click)="reviewOpen.set(true)">
                <ion-icon slot="start" name="star-outline" /> Leave a review
              </ion-button>
            }
            @if (canCancel(b)) {
              <ion-button expand="block" fill="outline" color="danger" (click)="startCancel(b)">
                <ion-icon slot="start" name="close-circle-outline" /> Cancel booking
              </ion-button>
            }
            @if (b.status === 'completed' && !b.disputeInfo) {
              <ion-button expand="block" fill="clear" color="medium" (click)="raiseDispute(b)">
                Report a problem
              </ion-button>
            }
          </div>
        </div>
      }
    </ion-content>

    <!-- Review sheet ------------------------------------------------------- -->
    <ion-modal [isOpen]="reviewOpen()" (didDismiss)="reviewOpen.set(false)"
               [initialBreakpoint]="0.6" [breakpoints]="[0, 0.6]">
      <ng-template>
        <ion-content class="ion-padding">
          <h2 class="sheet-title">How was it?</h2>
          <div class="rate">
            @for (star of [1,2,3,4,5]; track star) {
              <button (click)="rating.set(star)" [attr.aria-label]="star + ' stars'">
                <ion-icon [name]="star <= rating() ? 'star' : 'star-outline'" />
              </button>
            }
          </div>
          <ion-item class="je-field" lines="none">
            <ion-textarea [rows]="4" [autoGrow]="true" placeholder="Tell others about your experience"
                          [value]="reviewText()" (ionInput)="reviewText.set($any($event.target).value)" />
          </ion-item>
          <ion-button expand="block" class="je-btn-gradient" (click)="submitReview()"
                      [disabled]="rating() === 0">
            Submit review
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>

    <!-- Cancellation sheet -------------------------------------------------- -->
    <ion-modal [isOpen]="cancelOpen()" (didDismiss)="cancelOpen.set(false)"
               [initialBreakpoint]="0.7" [breakpoints]="[0, 0.7]">
      <ng-template>
        <ion-content class="ion-padding">
          <h2 class="sheet-title">Cancel this booking?</h2>
          @if (cancelPreview(); as preview) {
            <div class="je-card">
              <p class="je-sm je-muted">{{ preview.policyLabel }}</p>
              <div class="line"><span class="je-sm je-muted">Cancellation fee</span>
                <span class="je-sm">{{ preview.cancellationFee | inr }}</span></div>
              <div class="line line--total"><strong>You get back</strong>
                <strong class="je-price">{{ preview.refundAmount | inr }}</strong></div>
              <p class="je-xs je-soft note">
                The final amount is confirmed by JoinEvents once the cancellation is processed.
              </p>
            </div>
          }
          <ion-item class="je-field" lines="none">
            <ion-textarea [rows]="3" [autoGrow]="true" placeholder="Why are you cancelling?"
                          [value]="cancelReason()" (ionInput)="cancelReason.set($any($event.target).value)" />
          </ion-item>
          <ion-button expand="block" color="danger" (click)="confirmCancel()"
                      [disabled]="!cancelReason().trim()">
            Confirm cancellation
          </ion-button>
          <ion-button expand="block" fill="clear" color="medium" (click)="cancelOpen.set(false)">
            Keep my booking
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }
    .head__top { display: flex; align-items: center; justify-content: space-between; }
    .head h1 { font-size: var(--je-fs-lg); margin: 10px 0 12px; }
    .meta { display: flex; align-items: center; gap: 7px; margin: 0 0 6px;
            font-size: var(--je-fs-sm); color: var(--je-text-muted); }

    .step { display: flex; gap: 12px; padding-bottom: 18px; position: relative; }
    .step:last-child { padding-bottom: 0; }
    .step:not(:last-child)::before { content: ''; position: absolute; left: 10px; top: 22px; bottom: 0;
                                     width: 2px; background: var(--je-border-color); }
    .step__dot { width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; z-index: 1;
                 display: grid; place-items: center; background: var(--je-bg-light);
                 border: 2px solid var(--je-border-color); }
    .step--done .step__dot { background: var(--je-success); border-color: var(--je-success); color: #fff; }
    .step--current .step__dot { border-color: var(--je-primary); background: var(--je-primary); }
    .step__dot ion-icon { font-size: 11px; }
    .step__body { display: flex; flex-direction: column; gap: 2px; }
    .step:not(.step--done):not(.step--current) .step__body strong { color: var(--je-text-soft); }

    .vendor { display: flex; align-items: center; gap: 12px; }
    .vendor__avatar { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
                      border-radius: 50%; background: var(--je-gradient-secondary); color: #fff;
                      font-weight: 700; font-size: var(--je-fs-sm); }
    .vendor__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

    .svc { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0;
           border-bottom: 1px solid var(--je-border-color); }
    .svc:last-child { border-bottom: none; }
    .svc__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .svc__end { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }

    .line { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
    .line--total { margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .note { display: flex; align-items: center; gap: 6px; margin: 12px 0 0; }

    .acts { display: flex; flex-direction: column; gap: 8px; padding-bottom: 24px; }

    .sheet-title { font-size: var(--je-fs-lg); margin: 4px 0 18px; }
    .rate { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; }
    .rate button { background: none; border: none; padding: 4px; }
    .rate ion-icon { font-size: 34px; color: var(--je-accent); }
  `]
})
export class BookingDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private reviewService = inject(ReviewService);
  private shareService = inject(ShareService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly booking = signal<Booking | null>(null);

  readonly reviewOpen = signal(false);
  readonly rating = signal(0);
  readonly reviewText = signal('');

  readonly cancelOpen = signal(false);
  readonly cancelReason = signal('');
  readonly cancelPreview = signal<CancellationBreakdown | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.bookingService.getById(id).subscribe(booking => {
      this.booking.set(booking);
      this.loading.set(false);
    });
  }

  /** Booking lifecycle rendered as a progress list. */
  timeline(): { key: string; label: string; hint: string; done: boolean; current: boolean }[] {
    const status = this.booking()?.status ?? 'pending';
    const order = ['pending', 'advance_paid', 'confirmed', 'in_progress', 'completed', 'settled'];
    const currentIndex = order.indexOf(status);

    const steps = [
      { key: 'pending', label: 'Booking raised', hint: 'Waiting for your advance payment' },
      { key: 'advance_paid', label: 'Advance paid', hint: 'Held securely in escrow' },
      { key: 'confirmed', label: 'Vendor confirmed', hint: 'The vendor has accepted your date' },
      { key: 'in_progress', label: 'Event day', hint: 'Your event is under way' },
      { key: 'completed', label: 'Completed', hint: 'Balance settled and event wrapped up' },
      { key: 'settled', label: 'Settled', hint: 'Vendor paid out' }
    ];

    return steps.map((step, index) => ({
      ...step,
      done: currentIndex > index,
      current: currentIndex === index
    }));
  }

  /** The GST share of the total, as the server priced it. */
  gst(booking: Booking): number {
    const gst = (booking.totalAmount ?? 0) - (booking.damageCharges ?? 0) - (booking.baseAmount ?? 0);
    return Math.max(0, Math.round(gst * 100) / 100);
  }

  /** What has been paid so far, from confirmed payments. */
  paid(booking: Booking): number {
    return booking.amountPaid ?? (booking.status === 'pending' ? 0 : booking.finalPaidAmount ?? booking.advanceAmount ?? 0);
  }

  balanceDue(booking: Booking): number {
    return booking.balanceDue ?? Math.max(0, (booking.totalAmount ?? 0) - this.paid(booking));
  }

  canPay(booking: Booking): boolean {
    return this.balanceDue(booking) > 0 && !['cancelled', 'rejected', 'disputed'].includes(booking.status);
  }

  canCancel(booking: Booking): boolean {
    return ['pending', 'advance_paid', 'confirmed'].includes(booking.status);
  }

  payBalance(booking: Booking): void {
    void this.router.navigate(['/customer/checkout', booking.id]);
  }

  async share(): Promise<void> {
    const booking = this.booking();
    if (!booking) return;
    await this.shareService.shareBooking(
      booking.bookingNumber || booking.id.slice(0, 8),
      booking.eventName,
      new Date(booking.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    );
  }

  submitReview(): void {
    const booking = this.booking();
    if (!booking?.vendorId) return;

    this.reviewService
      .submit({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        rating: this.rating(),
        comment: this.reviewText().trim()
      })
      .subscribe(success => {
        this.reviewOpen.set(false);
        if (!success) {
          void this.toast.error('We could not save your review. Please try again.');
          return;
        }
        void this.toast.success('Thanks for the review — reward points are on their way.');
        this.load();
      });
  }

  startCancel(booking: Booking): void {
    this.cancelPreview.set(this.bookingService.previewCancellation(booking, 'customer'));
    this.cancelOpen.set(true);
  }

  confirmCancel(): void {
    const booking = this.booking();
    if (!booking) return;

    this.bookingService.cancel(booking.id, this.cancelReason().trim(), 'customer').subscribe(success => {
      this.cancelOpen.set(false);
      if (!success) {
        void this.toast.error('The cancellation did not go through. Please contact support.');
        return;
      }
      void this.toast.success('Booking cancelled. Any refund will be processed shortly.');
      this.load();
    });
  }

  async raiseDispute(booking: Booking): Promise<void> {
    const reason = await this.toast.prompt('Report a problem', 'Describe what went wrong', 'Submit');
    if (!reason) return;

    this.bookingService.raiseDispute(booking.id, reason).subscribe(success => {
      if (!success) {
        void this.toast.error('We could not raise the dispute. Please try again.');
        return;
      }
      void this.toast.success('Reported. Our support team will be in touch.');
      this.load();
    });
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }
}
