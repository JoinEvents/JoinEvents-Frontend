import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel,
  IonIcon, IonButton, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { BookingService } from '../../core/services/booking.service';
import { ToastService } from '../../core/services/toast.service';
import { Booking, BookingStatus } from '../../core/models/booking.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { PhoneMaskPipe } from '../../shared/pipes/phone-mask.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type Tab = 'requests' | 'confirmed' | 'completed';

/**
 * Booking requests and the vendor's schedule. Accepting or declining is the
 * single most time-sensitive action a vendor takes, so it is inline on the
 * card rather than behind a detail screen.
 */
@Component({
  selector: 'app-vendor-bookings',
  standalone: true,
  imports: [
    DatePipe, CurrencyInrPipe, PhoneMaskPipe, StatusPillComponent, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel,
    IonIcon, IonButton, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Bookings</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab()" (ionChange)="tab.set($any($event.detail.value))">
          <ion-segment-button value="requests">
            <ion-label>Requests ({{ requests().length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="confirmed"><ion-label>Confirmed</ion-label></ion-segment-button>
          <ion-segment-button value="completed"><ion-label>Done</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="4" />
        } @else if (!visible().length) {
          <app-empty-state icon="journal-outline" [title]="emptyTitle()" [message]="emptyMessage()" />
        } @else {
          @for (booking of visible(); track booking.id) {
            <div class="je-card card">
              <div class="card__head">
                <div class="card__title">
                  <strong class="je-truncate">{{ booking.eventName }}</strong>
                  <span class="je-xs je-soft">{{ booking.bookingNumber || booking.id.slice(0, 8) }}</span>
                </div>
                <app-status-pill [status]="booking.status" />
              </div>

              <div class="grid">
                <span class="je-sm je-muted"><ion-icon name="calendar-outline" /> {{ booking.eventDate | date: 'd MMM y' }}</span>
                <span class="je-sm je-muted"><ion-icon name="people-outline" /> {{ booking.guestCount }} guests</span>
                <span class="je-sm je-muted je-truncate"><ion-icon name="location-outline" /> {{ booking.venue }}</span>
                <span class="je-sm je-muted je-truncate"><ion-icon name="person-outline" /> {{ booking.customerName }}</span>
              </div>

              @if (booking.notes) {
                <p class="notes je-xs je-muted je-clamp-2">
                  <ion-icon name="chatbox-outline" /> {{ booking.notes }}
                </p>
              }

              <div class="card__foot">
                <div class="money">
                  <span class="je-price">{{ booking.totalAmount | inr }}</span>
                  <span class="je-xs je-soft">
                    Your payout {{ (booking.vendorPayoutAmount ?? booking.totalAmount * 0.85) | inr: true }}
                  </span>
                </div>

                @if (booking.status === 'advance_paid' || booking.status === 'pending') {
                  <div class="acts">
                    <ion-button size="small" fill="outline" color="danger" (click)="decline(booking)">
                      Decline
                    </ion-button>
                    <ion-button size="small" class="je-btn-gradient" (click)="accept(booking)">
                      Accept
                    </ion-button>
                  </div>
                } @else if (booking.status === 'confirmed') {
                  <div class="acts">
                    @if (booking.customerPhone) {
                      <ion-button size="small" fill="outline" [href]="'tel:' + booking.customerPhone">
                        <ion-icon slot="icon-only" name="call-outline" />
                      </ion-button>
                    }
                    <ion-button size="small" class="je-btn-gradient" (click)="markStatus(booking, 'in_progress')">
                      Start event
                    </ion-button>
                  </div>
                } @else if (booking.status === 'in_progress') {
                  <ion-button size="small" class="je-btn-gradient" (click)="markStatus(booking, 'completed')">
                    Mark complete
                  </ion-button>
                }
              </div>

              @if (booking.status === 'confirmed' && booking.customerPhone) {
                <p class="je-xs je-soft contact">
                  Customer contact: {{ booking.customerPhone | phoneMask: true }}
                </p>
              }
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__title { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
    .card__title strong { font-size: var(--je-fs-base); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 12px; }
    .grid span { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
    .notes { display: flex; align-items: flex-start; gap: 6px; margin: 12px 0 0;
             padding: 9px 11px; border-radius: var(--je-radius-sm); background: var(--je-bg-light); }
    .card__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px;
                  margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .money { display: flex; flex-direction: column; gap: 2px; }
    .acts { display: flex; gap: 8px; flex-shrink: 0; }
    .contact { margin: 10px 0 0; }
  `]
})
export class VendorBookingsPage implements ViewWillEnter {
  private bookingService = inject(BookingService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly bookings = signal<Booking[]>([]);
  readonly tab = signal<Tab>('requests');

  readonly requests = computed(() =>
    this.bookings().filter(b => ['pending', 'advance_paid'].includes(b.status))
  );

  readonly visible = computed(() => {
    switch (this.tab()) {
      case 'requests':
        return this.requests();
      case 'confirmed':
        return this.bookings()
          .filter(b => ['confirmed', 'in_progress'].includes(b.status))
          .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
      case 'completed':
        return this.bookings().filter(b => ['completed', 'settled', 'cancelled', 'rejected'].includes(b.status));
    }
  });

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.bookingService.getVendorBookings().subscribe(bookings => {
      this.bookings.set(bookings);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  accept(booking: Booking): void {
    this.markStatus(booking, 'confirmed', 'Booking confirmed — the customer has been notified.');
  }

  async decline(booking: Booking): Promise<void> {
    const confirmed = await this.toast.confirm(
      'Decline this request?',
      'The customer is refunded in full and repeated declines affect your ranking.',
      'Decline',
      true
    );
    if (!confirmed) return;

    const reason = await this.toast.prompt('Why are you declining?', 'e.g. already booked that date');
    if (!reason) return;

    this.bookingService.cancel(booking.id, reason, 'vendor').subscribe(success => {
      if (!success) {
        void this.toast.error('We could not decline the request. Please try again.');
        return;
      }
      void this.toast.success('Request declined.');
      this.load();
    });
  }

  markStatus(booking: Booking, status: BookingStatus, message?: string): void {
    this.bookingService.updateStatus(booking.id, status).subscribe(success => {
      if (!success) {
        void this.toast.error('Could not update the booking. Please try again.');
        return;
      }
      void this.toast.success(message ?? 'Booking updated.');
      this.load();
    });
  }

  emptyTitle(): string {
    switch (this.tab()) {
      case 'requests': return 'No new requests';
      case 'confirmed': return 'Nothing confirmed';
      case 'completed': return 'No past bookings';
    }
  }

  emptyMessage(): string {
    switch (this.tab()) {
      case 'requests': return 'New booking requests will land here for you to accept or decline.';
      case 'confirmed': return 'Bookings you have accepted appear here in date order.';
      case 'completed': return 'Completed, settled and cancelled bookings are kept here.';
    }
  }
}
