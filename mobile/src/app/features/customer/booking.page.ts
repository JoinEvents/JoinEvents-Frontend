import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonInput, IonSpinner, IonDatetime, IonModal, IonLabel
} from '@ionic/angular/standalone';

import { PackageService } from '../../core/services/package.service';
import { BookingService } from '../../core/services/booking.service';
import { VendorService } from '../../core/services/vendor.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { EventPackage } from '../../core/models/event.model';
import { BookingQuote } from '../../core/models/booking.model';
import { CheckoutDraftService } from '../../core/services/checkout-draft.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

/**
 * Booking form. Collects the event details, checks the vendor's calendar for the
 * chosen date, and shows the server's price for the guest count — the same
 * amount checkout will charge.
 */
@Component({
  selector: 'app-customer-booking',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonInput, IonSpinner, IonDatetime, IonModal, IonLabel
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/events" text="" />
        </ion-buttons>
        <ion-title>Book this package</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent" /></div>
      } @else if (pkg(); as p) {
        <div class="je-section">
          <!-- Package summary ------------------------------------------- -->
          <div class="je-card summary">
            @if (p.image) { <img [src]="p.image" [alt]="p.name" /> }
            <div class="summary__body">
              <strong class="je-clamp-2">{{ p.name }}</strong>
              <span class="je-xs je-muted">{{ p.vendorName || 'JoinEvents partner' }}</span>
              @if (p.maxGuests) { <span class="je-xs je-muted">Up to {{ p.maxGuests }} guests</span> }
            </div>
          </div>

          <form [formGroup]="form">
            <div class="je-section-head"><h2>Event details</h2></div>

            <ion-item class="je-field" lines="none">
              <ion-icon name="text-outline" slot="start" color="medium" />
              <ion-input formControlName="eventName" [placeholder]="'Event name (optional) — ' + p.name" />
            </ion-item>

            <ion-item class="je-field" lines="none" button (click)="datePickerOpen.set(true)">
              <ion-icon name="calendar-outline" slot="start" color="medium" />
              <ion-label [class.placeholder]="!form.controls.eventDate.value">
                {{ form.controls.eventDate.value ? (displayDate()) : 'Select the event date' }}
              </ion-label>
              @if (checkingDate()) { <ion-spinner slot="end" name="dots" /> }
            </ion-item>
            @if (dateUnavailable()) {
              <p class="je-error">This vendor is unavailable on that date. Please pick another.</p>
            }

            <ion-item class="je-field" lines="none">
              <ion-icon name="people-outline" slot="start" color="medium" />
              <ion-input formControlName="guestCount" type="number" inputmode="numeric" min="1"
                         placeholder="Number of guests" />
            </ion-item>
            @if (p.maxGuests) {
              <p class="je-xs je-muted hint" [class.je-error]="overCapacity()">This package caters for up to {{ p.maxGuests }} guests.</p>
            }

            <ion-item class="je-field" lines="none">
              <ion-icon name="business-outline" slot="start" color="medium" />
              <ion-input formControlName="venue" placeholder="Venue address" />
            </ion-item>

            <ion-item class="je-field" lines="none">
              <ion-icon name="location-outline" slot="start" color="medium" />
              <ion-input formControlName="city" placeholder="City" />
            </ion-item>

            <!-- Price breakdown: the server's price for this guest count ---- -->
            <div class="je-section-head"><h2>Price breakdown</h2></div>
            <div class="je-card">
              @if (quoting()) {
                <div class="center-sm"><ion-spinner name="dots" /></div>
              } @else if (quoteError()) {
                <p class="je-error flush">{{ quoteError() }}</p>
              } @else if (quote(); as q) {
                @for (line of q.lines; track line.description) {
                  <div class="line">
                    <span class="je-sm je-muted">
                      {{ line.description }}
                      @if (line.detail) { <span class="je-xs je-soft detail">{{ line.detail }}</span> }
                    </span>
                    <span class="je-sm">{{ line.amount | inr }}</span>
                  </div>
                }
                <div class="line">
                  <span class="je-sm je-muted">GST ({{ q.gstPercent }}%)</span>
                  <span class="je-sm">{{ q.gstAmount | inr }}</span>
                </div>
                <div class="line line--total">
                  <strong>Total</strong>
                  <strong class="je-price">{{ q.totalAmount | inr }}</strong>
                </div>
                <div class="line line--advance">
                  <span class="je-sm je-bold">Advance ({{ q.advancePercent }}%)</span>
                  <span class="je-sm je-bold">{{ q.advanceAmount | inr }}</span>
                </div>
                <p class="je-xs je-soft note">
                  At checkout you can pay the advance or the full amount. Your payment is held in
                  escrow and released to the vendor after the event.
                </p>
              } @else {
                <p class="je-sm je-muted flush">Enter the number of guests to see the price.</p>
              }
            </div>
          </form>
        </div>

        <div class="je-action-bar">
          <div class="bar__price">
            <span class="je-xs je-soft">{{ quote() ? 'Total incl. GST' : 'Listed price' }}</span>
            <strong class="je-price">{{ (quote()?.totalAmount ?? p.price) | inr }}</strong>
          </div>
          <ion-button class="je-btn-gradient bar__cta" (click)="submit()"
                      [disabled]="dateUnavailable() || checkingDate() || quoting() || !quote()">
            Continue to payment
          </ion-button>
        </div>
      } @else {
        <div class="je-empty">
          <ion-icon name="alert-circle-outline" />
          <h3>Package unavailable</h3>
          <p>It may have been removed or is no longer accepting bookings.</p>
        </div>
      }
    </ion-content>

    <!-- Date picker ---------------------------------------------------------- -->
    <ion-modal [isOpen]="datePickerOpen()" (didDismiss)="datePickerOpen.set(false)"
               [initialBreakpoint]="0.6" [breakpoints]="[0, 0.6]">
      <ng-template>
        <ion-content class="ion-padding">
          <ion-datetime presentation="date" [min]="minDate" [preferWheel]="false"
                        (ionChange)="onDateChosen($any($event.detail.value))" />
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }
    .summary { display: flex; gap: 14px; align-items: center; margin-top: 8px; }
    .summary img { width: 74px; height: 74px; border-radius: var(--je-radius-sm); object-fit: cover; flex-shrink: 0; }
    .summary__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .summary__body strong { font-size: var(--je-fs-base); }
    .placeholder { color: var(--je-text-soft); }
    .line { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; }
    .line--total { margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .line--advance { padding: 10px 12px; margin-top: 8px; border-radius: var(--je-radius-sm);
                     background: rgba(255, 107, 53, 0.08); color: var(--je-primary); }
    .note { margin: 12px 0 0; line-height: 1.55; }
    .center-sm { display: grid; place-items: center; padding: 12px 0; }
    .flush { margin: 0; }
    .hint { margin: 2px 4px 8px; }
    .detail { display: block; }
    .bar__price { display: flex; flex-direction: column; line-height: 1.25; }
    .bar__price .je-price { font-size: var(--je-fs-md); }
    .bar__cta { flex: 1; margin: 0; }
  `]
})
export class CustomerBookingPage implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private packageService = inject(PackageService);
  private bookingService = inject(BookingService);
  private vendorService = inject(VendorService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private drafts = inject(CheckoutDraftService);
  private destroyRef = inject(DestroyRef);

  readonly minDate = new Date().toISOString().slice(0, 10);

  readonly loading = signal(true);
  readonly pkg = signal<EventPackage | null>(null);
  readonly datePickerOpen = signal(false);
  readonly checkingDate = signal(false);
  readonly dateUnavailable = signal(false);

  /** The server's price for the chosen guest count — what the booking will actually charge. */
  readonly quote = signal<BookingQuote | null>(null);
  readonly quoteError = signal('');
  readonly quoting = signal(false);

  readonly form = this.fb.nonNullable.group({
    eventName: [''],
    eventDate: ['', Validators.required],
    guestCount: [0, [Validators.required, Validators.min(1)]],
    venue: ['', Validators.required],
    city: ['', Validators.required]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('packageId');
    if (!id) {
      this.loading.set(false);
      return;
    }

    // Re-price whenever the guest count settles.
    this.form.controls.guestCount.valueChanges
      .pipe(
        map(value => Math.floor(Number(value) || 0)),
        debounceTime(350),
        distinctUntilChanged(),
        tap(() => {
          this.quoteError.set('');
          this.quoting.set(true);
        }),
        switchMap(guests => {
          const pkg = this.pkg();
          return pkg && guests > 0 ? this.bookingService.quote(pkg.id, guests) : of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        this.quoting.set(false);
        if (!result) {
          this.quote.set(null);
        } else if (result.ok) {
          this.quote.set(result.value);
        } else {
          this.quote.set(null);
          this.quoteError.set(result.error);
        }
      });

    this.packageService.getById(id).subscribe(pkg => {
      this.pkg.set(pkg);
      if (pkg) {
        // Start from the package's own address and capacity; the customer can change them.
        const address = pkg.address ?? {};
        this.form.patchValue({
          city: address.city ?? '',
          venue: [address.street, address.locality, address.city].filter(part => !!part?.trim()).join(', '),
          guestCount: pkg.maxGuests > 0 ? pkg.maxGuests : 0
        });
      }
      this.loading.set(false);
    });
  }

  overCapacity(): boolean {
    const max = this.pkg()?.maxGuests ?? 0;
    return max > 0 && Number(this.form.controls.guestCount.value) > max;
  }

  displayDate(): string {
    const value = this.form.controls.eventDate.value;
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }

  onDateChosen(value: string | string[] | null): void {
    const date = Array.isArray(value) ? value[0] : value;
    if (!date) return;
    this.form.controls.eventDate.setValue(date.slice(0, 10));
    this.datePickerOpen.set(false);
    this.verifyAvailability(date.slice(0, 10));
  }

  submit(): void {
    const pkg = this.pkg();
    if (!pkg) return;

    if (this.auth.currentUser()?.role && this.auth.currentUser()?.role !== 'customer') {
      void this.toast.error('Sign in with a customer account to book a package.');
      return;
    }
    const controls = this.form.controls;
    if (controls.eventDate.invalid) {
      void this.toast.error('Select the event date.');
      return;
    }
    if (controls.guestCount.invalid) {
      void this.toast.error('Enter the number of guests.');
      return;
    }
    if (this.overCapacity()) {
      void this.toast.error(`This package caters for up to ${pkg.maxGuests} guests.`);
      return;
    }
    if (!controls.venue.value.trim()) {
      void this.toast.error('Enter the venue of the event.');
      return;
    }
    if (!controls.city.value.trim()) {
      void this.toast.error('Enter the city of the event.');
      return;
    }
    if (this.dateUnavailable()) {
      void this.toast.error('The vendor is not available on that date. Please pick another.');
      return;
    }
    if (this.quoteError()) {
      void this.toast.error(this.quoteError());
      return;
    }
    if (!this.quote()) return;

    const value = this.form.getRawValue();
    this.drafts.set({
      packageId: pkg.id,
      vendorId: pkg.vendorId,
      packageName: pkg.name,
      image: pkg.image,
      eventName: value.eventName.trim() || pkg.name,
      eventDate: value.eventDate,
      venue: value.venue.trim(),
      city: value.city.trim(),
      guestCount: Math.floor(Number(value.guestCount))
    });
    void this.router.navigate(['/customer/checkout', 'new']);
  }

  /**
   * Checks the vendor's calendar as soon as a date is picked, so an unavailable
   * date is caught here instead of at payment.
   */
  private verifyAvailability(date: string): void {
    const vendorId = this.pkg()?.vendorId;
    if (!vendorId) return;

    this.checkingDate.set(true);
    this.vendorService.checkAvailability(vendorId, date).subscribe(available => {
      this.checkingDate.set(false);
      this.dateUnavailable.set(!available);
      if (!available) void this.toast.warning('The vendor is not available on that date.');
    });
  }
}
