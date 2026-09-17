import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel,
  IonIcon, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';

import { BookingService } from '../../core/services/booking.service';
import { Booking } from '../../core/models/booking.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type Filter = 'upcoming' | 'past' | 'cancelled';

@Component({
  selector: 'app-customer-bookings',
  standalone: true,
  imports: [
    DatePipe, RouterLink, CurrencyInrPipe, StatusPillComponent, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel,
    IonIcon, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>My bookings</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event.detail.value))">
          <ion-segment-button value="upcoming"><ion-label>Upcoming</ion-label></ion-segment-button>
          <ion-segment-button value="past"><ion-label>Past</ion-label></ion-segment-button>
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
          <app-list-skeleton [count]="4" />
        } @else if (!visible().length) {
          <app-empty-state
            icon="journal-outline"
            [title]="emptyTitle()"
            [message]="emptyMessage()" />
        } @else {
          @for (booking of visible(); track booking.id) {
            <a class="je-card card" [routerLink]="['/customer/booking', booking.id]">
              <div class="card__head">
                <div class="card__title">
                  <strong class="je-truncate">{{ booking.eventName }}</strong>
                  <span class="je-xs je-soft">{{ booking.bookingNumber || booking.id.slice(0, 8) }}</span>
                </div>
                <app-status-pill [status]="booking.status" />
              </div>

              <div class="card__meta">
                <span class="je-sm je-muted">
                  <ion-icon name="calendar-outline" /> {{ booking.eventDate | date: 'd MMM y' }}
                </span>
                <span class="je-sm je-muted je-truncate">
                  <ion-icon name="location-outline" /> {{ booking.city }}
                </span>
              </div>

              @if (booking.vendorName) {
                <p class="je-xs je-muted vendor je-truncate">
                  <ion-icon name="storefront-outline" /> {{ booking.vendorName }}
                </p>
              }

              <div class="card__foot">
                <div class="amounts">
                  <span class="je-price">{{ booking.totalAmount | inr }}</span>
                  @if (booking.status === 'pending') {
                    <span class="je-xs je-soft">{{ booking.advanceAmount | inr }} advance due</span>
                  }
                </div>
                <ion-icon name="chevron-forward" color="medium" />
              </div>
            </a>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .card { display: block; text-decoration: none; }
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__title { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
    .card__title strong { font-size: var(--je-fs-base); color: var(--je-text-main); }
    .card__meta { display: flex; gap: 16px; margin-top: 12px; }
    .card__meta span { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
    .vendor { display: flex; align-items: center; gap: 5px; margin: 8px 0 0; }
    .card__foot { display: flex; align-items: center; justify-content: space-between;
                  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .amounts { display: flex; flex-direction: column; gap: 2px; }
  `]
})
export class CustomerBookingsPage implements OnInit {
  private bookingService = inject(BookingService);

  readonly loading = signal(true);
  readonly bookings = signal<Booking[]>([]);
  readonly filter = signal<Filter>('upcoming');

  readonly visible = computed(() => {
    const all = this.bookings();
    const now = Date.now();

    switch (this.filter()) {
      case 'upcoming':
        return all
          .filter(b => !this.isCancelled(b) && new Date(b.eventDate).getTime() >= now)
          .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
      case 'past':
        return all
          .filter(b => !this.isCancelled(b) && new Date(b.eventDate).getTime() < now)
          .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
      case 'cancelled':
        return all.filter(b => this.isCancelled(b));
    }
  });

  ngOnInit(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.bookingService.getMyBookings().subscribe(bookings => {
      this.bookings.set(bookings);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  emptyTitle(): string {
    switch (this.filter()) {
      case 'upcoming': return 'No upcoming events';
      case 'past': return 'No past events';
      case 'cancelled': return 'Nothing cancelled';
    }
  }

  emptyMessage(): string {
    switch (this.filter()) {
      case 'upcoming': return 'Browse packages to plan your next event.';
      case 'past': return 'Events you have completed will be listed here.';
      case 'cancelled': return 'Cancelled and rejected bookings appear here.';
    }
  }

  private isCancelled(booking: Booking): boolean {
    return ['cancelled', 'rejected'].includes(booking.status);
  }
}
