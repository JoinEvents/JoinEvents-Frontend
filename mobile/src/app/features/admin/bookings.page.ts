import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonSegment, IonSegmentButton,
  IonLabel, IonIcon, IonRefresher, IonRefresherContent, IonButton
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { BookingService } from '../../core/services/booking.service';
import { SupportService } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { Booking } from '../../core/models/booking.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { PhoneMaskPipe } from '../../shared/pipes/phone-mask.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type Filter = 'all' | 'active' | 'disputed' | 'cancelled';

/**
 * Platform-wide booking monitor for admins and support agents. Customer and
 * vendor numbers are masked by default — an agent rarely needs the full number
 * on screen to resolve a ticket.
 */
@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [
    DatePipe, CurrencyInrPipe, PhoneMaskPipe, StatusPillComponent, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonSegment, IonSegmentButton,
    IonLabel, IonIcon, IonRefresher, IonRefresherContent, IonButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Bookings</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Search by booking, customer or vendor" [debounce]="300"
                       (ionInput)="query.set($any($event.target).value ?? '')" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event.detail.value))">
          <ion-segment-button value="all"><ion-label>All</ion-label></ion-segment-button>
          <ion-segment-button value="active"><ion-label>Active</ion-label></ion-segment-button>
          <ion-segment-button value="disputed"><ion-label>Disputed</ion-label></ion-segment-button>
          <ion-segment-button value="cancelled"><ion-label>Cancelled</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="5" />
        } @else if (!visible().length) {
          <app-empty-state icon="journal-outline" title="Nothing here"
                           message="No bookings match this filter or search." />
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

              <div class="parties">
                <div class="party">
                  <span class="je-xs je-soft">Customer</span>
                  <strong class="je-sm je-truncate">{{ booking.customerName }}</strong>
                  <span class="je-xs je-muted">{{ booking.customerPhone | phoneMask }}</span>
                </div>
                <div class="party">
                  <span class="je-xs je-soft">Vendor</span>
                  <strong class="je-sm je-truncate">{{ booking.vendorName || 'Unassigned' }}</strong>
                  <span class="je-xs je-muted">{{ booking.vendorPhone | phoneMask }}</span>
                </div>
              </div>

              <div class="grid">
                <span class="je-xs je-muted"><ion-icon name="calendar-outline" /> {{ booking.eventDate | date: 'd MMM y' }}</span>
                <span class="je-xs je-muted"><ion-icon name="location-outline" /> {{ booking.city }}</span>
                <span class="je-xs je-muted"><ion-icon name="cash-outline" /> {{ booking.totalAmount | inr: true }}</span>
                @if (booking.escrowStatus) {
                  <span class="je-xs je-muted"><ion-icon name="lock-closed-outline" /> Escrow {{ booking.escrowStatus }}</span>
                }
              </div>

              @if (booking.disputeInfo) {
                <p class="dispute je-xs">
                  <ion-icon name="alert-circle" /> {{ booking.disputeInfo.reason }}
                </p>
              }

              @if (booking.assignedTo) {
                <p class="je-xs je-soft assigned">Assigned to {{ booking.assignedTo }}</p>
              }

              <div class="card__foot">
                <ion-button size="small" fill="clear" (click)="addNote(booking)">
                  <ion-icon slot="start" name="create-outline" /> Note
                </ion-button>
                <ion-button size="small" fill="clear" (click)="messageCustomer(booking)">
                  <ion-icon slot="start" name="mail-outline" /> Update customer
                </ion-button>
                @if (booking.vendorId) {
                  <ion-button size="small" fill="clear" (click)="remindVendor(booking)">
                    <ion-icon slot="start" name="notifications-outline" /> Nudge vendor
                  </ion-button>
                }
              </div>
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
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px;
               padding: 11px 12px; border-radius: var(--je-radius-sm); background: var(--je-bg-light); }
    .party { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 12px; margin-top: 12px; }
    .grid span { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
    .dispute { display: flex; align-items: flex-start; gap: 6px; margin: 12px 0 0;
               padding: 9px 11px; border-radius: var(--je-radius-sm);
               background: rgba(220,38,38,0.08); color: var(--je-danger); }
    .assigned { margin: 10px 0 0; }
    .card__foot { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px;
                  padding-top: 8px; border-top: 1px solid var(--je-border-color); }
  `]
})
export class AdminBookingsPage implements ViewWillEnter {
  private bookingService = inject(BookingService);
  private supportService = inject(SupportService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly bookings = signal<Booking[]>([]);
  readonly filter = signal<Filter>('all');
  readonly query = signal('');

  readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();

    return this.bookings()
      .filter(b => {
        switch (this.filter()) {
          case 'active': return ['pending', 'advance_paid', 'confirmed', 'in_progress'].includes(b.status);
          case 'disputed': return b.status === 'disputed' || !!b.disputeInfo;
          case 'cancelled': return ['cancelled', 'rejected'].includes(b.status);
          default: return true;
        }
      })
      .filter(b =>
        !term ||
        b.eventName.toLowerCase().includes(term) ||
        (b.bookingNumber ?? '').toLowerCase().includes(term) ||
        b.customerName.toLowerCase().includes(term) ||
        (b.vendorName ?? '').toLowerCase().includes(term)
      );
  });

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.bookingService.getSupportBookings().subscribe(bookings => {
      this.bookings.set(bookings);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  async addNote(booking: Booking): Promise<void> {
    const note = await this.toast.prompt('Internal note', 'Visible to staff only');
    if (!note) return;
    this.supportService.addBookingNote(booking.id, note).subscribe(success =>
      this.report(success, 'Note saved.')
    );
  }

  async messageCustomer(booking: Booking): Promise<void> {
    const message = await this.toast.prompt('Update the customer', 'This is sent to the customer', 'Send');
    if (!message) return;
    this.supportService.sendUserUpdate(booking.id, message).subscribe(success =>
      this.report(success, 'Update sent to the customer.')
    );
  }

  remindVendor(booking: Booking): void {
    if (!booking.vendorId) return;
    this.supportService.remindVendor(booking.id, booking.vendorId).subscribe(success =>
      this.report(success, 'Reminder sent to the vendor.')
    );
  }

  private report(success: boolean, message: string): void {
    if (!success) {
      void this.toast.error('That action did not go through. Please try again.');
      return;
    }
    void this.toast.success(message);
    this.load();
  }
}
