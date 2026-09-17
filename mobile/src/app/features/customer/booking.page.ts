import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonCheckbox, IonSpinner, IonDatetime, IonModal, IonLabel
} from '@ionic/angular/standalone';

import { PackageService } from '../../core/services/package.service';
import { BookingService } from '../../core/services/booking.service';
import { VendorService } from '../../core/services/vendor.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { EventPackage } from '../../core/models/event.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

/**
 * Booking form. Collects the event details, lets the user pick add-ons, checks
 * the vendor's calendar for the chosen date, and shows a running price
 * breakdown before it creates the booking.
 */
@Component({
  selector: 'app-customer-booking',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonInput, IonTextarea, IonCheckbox, IonSpinner, IonDatetime, IonModal, IonLabel
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
              <span class="je-price">{{ p.price | inr }}</span>
            </div>
          </div>

          <form [formGroup]="form">
            <div class="je-section-head"><h2>Event details</h2></div>

            <ion-item class="je-field" lines="none">
              <ion-icon name="text-outline" slot="start" color="medium" />
              <ion-input formControlName="eventName" placeholder="Event name (e.g. Riya's wedding)" />
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
              <ion-input formControlName="guestCount" type="number" inputmode="numeric"
                         placeholder="Number of guests" />
            </ion-item>
            @if (overCapacity()) {
              <p class="je-error">This package caters for up to {{ p.maxGuests }} guests.</p>
            }

            <ion-item class="je-field" lines="none">
              <ion-icon name="business-outline" slot="start" color="medium" />
              <ion-input formControlName="venue" placeholder="Venue" />
            </ion-item>

            <ion-item class="je-field" lines="none">
              <ion-icon name="location-outline" slot="start" color="medium" />
              <ion-input formControlName="city" placeholder="City" />
            </ion-item>

            <ion-item class="je-field" lines="none">
              <ion-icon name="chatbox-outline" slot="start" color="medium" />
              <ion-textarea formControlName="notes" [autoGrow]="true" [rows]="3"
                            placeholder="Anything the vendor should know? (optional)" />
            </ion-item>

            <!-- Add-ons ---------------------------------------------------- -->
            @if (p.addons?.length) {
              <div class="je-section-head"><h2>Add-ons</h2></div>
              <div class="je-card">
                @for (addon of p.addons; track addon.id) {
                  <ion-item lines="none" class="addon">
                    <ion-checkbox labelPlacement="end" justify="start"
                                  [checked]="selectedAddons().includes(addon.id)"
                                  (ionChange)="toggleAddon(addon.id)">
                      <span class="je-sm">{{ addon.name }}</span>
                    </ion-checkbox>
                    <strong slot="end" class="je-sm">+{{ addon.price | inr }}</strong>
                  </ion-item>
                }
              </div>
            }

            <!-- Price breakdown ---------------------------------------------- -->
            <div class="je-section-head"><h2>Price breakdown</h2></div>
            <div class="je-card">
              <div class="line">
                <span class="je-sm je-muted">Base package</span>
                <span class="je-sm">{{ p.price | inr }}</span>
              </div>
              @if (addonsTotal() > 0) {
                <div class="line">
                  <span class="je-sm je-muted">Add-ons</span>
                  <span class="je-sm">{{ addonsTotal() | inr }}</span>
                </div>
              }
              <div class="line">
                <span class="je-sm je-muted">GST ({{ gstPercent }}%)</span>
                <span class="je-sm">{{ gstAmount() | inr }}</span>
              </div>
              <div class="line line--total">
                <strong>Total</strong>
                <strong class="je-price">{{ total() | inr }}</strong>
              </div>
              <div class="line line--advance">
                <span class="je-sm je-bold">Pay now (25% advance)</span>
                <span class="je-sm je-bold">{{ advance() | inr }}</span>
              </div>
              <p class="je-xs je-soft note">
                The balance is due after the event. Your advance is held in escrow and released
                to the vendor only once the event is completed.
              </p>
            </div>
          </form>
        </div>

        <div class="je-action-bar">
          <div class="bar__price">
            <span class="je-xs je-soft">Advance due</span>
            <strong class="je-price">{{ advance() | inr }}</strong>
          </div>
          <ion-button class="je-btn-gradient bar__cta" (click)="submit()" [disabled]="submitting() || dateUnavailable()">
            @if (submitting()) { <ion-spinner name="crescent" /> } @else { Continue to payment }
          </ion-button>
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
    .addon { --background: transparent; --padding-start: 0; --inner-padding-end: 0; }
    .line { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; }
    .line--total { margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .line--advance { padding: 10px 12px; margin-top: 8px; border-radius: var(--je-radius-sm);
                     background: rgba(255, 107, 53, 0.08); color: var(--je-primary); }
    .note { margin: 12px 0 0; line-height: 1.55; }
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

  readonly gstPercent = 18;
  readonly advanceRate = 0.25;
  readonly minDate = new Date().toISOString().slice(0, 10);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly pkg = signal<EventPackage | null>(null);
  readonly selectedAddons = signal<string[]>([]);
  readonly datePickerOpen = signal(false);
  readonly checkingDate = signal(false);
  readonly dateUnavailable = signal(false);

  readonly form = this.fb.nonNullable.group({
    eventName: ['', Validators.required],
    eventDate: ['', Validators.required],
    guestCount: [50, [Validators.required, Validators.min(1)]],
    venue: ['', Validators.required],
    city: ['', Validators.required],
    notes: ['']
  });

  readonly addonsTotal = computed(() => {
    const addons = this.pkg()?.addons ?? [];
    return addons
      .filter(addon => this.selectedAddons().includes(addon.id))
      .reduce((sum, addon) => sum + addon.price, 0);
  });

  readonly subtotal = computed(() => (this.pkg()?.price ?? 0) + this.addonsTotal());
  readonly gstAmount = computed(() => Math.round(this.subtotal() * (this.gstPercent / 100)));
  readonly total = computed(() => this.subtotal() + this.gstAmount());
  readonly advance = computed(() => Math.round(this.total() * this.advanceRate));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('packageId');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.packageService.getById(id).subscribe(pkg => {
      this.pkg.set(pkg);
      if (pkg?.address?.city) this.form.controls.city.setValue(pkg.address.city);
      this.loading.set(false);
    });
  }

  overCapacity(): boolean {
    const max = this.pkg()?.maxGuests ?? 0;
    return max > 0 && this.form.controls.guestCount.value > max;
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

  toggleAddon(id: string): void {
    this.selectedAddons.update(list => (list.includes(id) ? list.filter(a => a !== id) : [...list, id]));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.toast.error('Please complete every field before continuing.');
      return;
    }
    if (this.overCapacity()) {
      void this.toast.error('Reduce the guest count or choose a larger package.');
      return;
    }

    const pkg = this.pkg();
    if (!pkg) return;

    this.submitting.set(true);
    const value = this.form.getRawValue();

    this.bookingService
      .create({
        packageId: pkg.id,
        vendorId: pkg.vendorId,
        customerId: this.auth.currentUser()?.id,
        eventTypeId: pkg.eventTypeId,
        eventName: value.eventName,
        eventDate: value.eventDate,
        venue: value.venue,
        city: value.city,
        guestCount: value.guestCount,
        notes: value.notes,
        addonIds: this.selectedAddons(),
        baseAmount: pkg.price,
        extraServicesAmount: this.addonsTotal(),
        gstPercent: this.gstPercent,
        totalAmount: this.total(),
        advanceAmount: this.advance()
      })
      .subscribe(booking => {
        this.submitting.set(false);
        if (!booking?.id) {
          void this.toast.error('We could not create the booking. Please try again.');
          return;
        }
        void this.router.navigate(['/customer/checkout', booking.id]);
      });
  }

  /**
   * Checks the vendor's calendar as soon as a date is picked, so an unavailable
   * date is caught here instead of failing after the user has paid.
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
