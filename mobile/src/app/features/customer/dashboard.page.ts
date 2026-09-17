import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonBadge,
  IonRefresher, IonRefresherContent, IonSkeletonText
} from '@ionic/angular/standalone';

import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Booking } from '../../core/models/booking.model';
import { EventType } from '../../core/models/event.model';
import { EventRfp } from '../../core/models/rfp.model';
import { CustomerProfile } from '../../core/models/user.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

/**
 * Customer home. Same cards as the web dashboard, reordered for a phone: the
 * next event first (the thing people open the app to check), then quick
 * actions, then categories and quotes.
 */
@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  imports: [
    DatePipe, RouterLink, CurrencyInrPipe, StatusPillComponent,
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonBadge,
    IonRefresher, IonRefresherContent, IonSkeletonText
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="greet" slot="start">
          <span class="je-xs je-muted">{{ greeting() }}</span>
          <strong>{{ auth.currentUser()?.name || 'there' }}</strong>
        </div>
        <ion-buttons slot="end">
          <ion-button routerLink="/customer/favorites">
            <ion-icon slot="icon-only" name="heart-outline" />
          </ion-button>
          <ion-button routerLink="/customer/notifications">
            <ion-icon slot="icon-only" name="notifications-outline" />
            @if (notifications.unreadCount() > 0) {
              <ion-badge color="danger" class="dot">{{ notifications.unreadCount() }}</ion-badge>
            }
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content pullingText="Pull to refresh" />
      </ion-refresher>

      <div class="je-section">
        <!-- Next event ------------------------------------------------- -->
        @if (loading()) {
          <div class="je-card">
            <ion-skeleton-text [animated]="true" style="width: 45%; height: 13px;" />
            <ion-skeleton-text [animated]="true" style="width: 75%; height: 22px; margin-top: 12px;" />
            <ion-skeleton-text [animated]="true" style="width: 60%; height: 13px;" />
          </div>
        } @else if (nextBooking(); as booking) {
          <a class="next je-gradient" [routerLink]="['/customer/booking', booking.id]">
            <div class="next__top">
              <span class="next__label">Your next event</span>
              <span class="next__days">{{ daysAway(booking.eventDate) }}</span>
            </div>
            <h2>{{ booking.eventName }}</h2>
            <p class="next__meta">
              <ion-icon name="calendar-outline" /> {{ booking.eventDate | date: 'EEE, d MMM y' }}
            </p>
            <p class="next__meta">
              <ion-icon name="location-outline" /> {{ booking.venue }}, {{ booking.city }}
            </p>
            <div class="next__foot">
              <app-status-pill [status]="booking.status" />
              <span class="next__amount">{{ booking.totalAmount | inr }}</span>
            </div>
          </a>
        } @else {
          <div class="je-card empty-next">
            <h3>No events planned yet</h3>
            <p class="je-sm je-muted">Browse packages or ask vendors for quotes to get started.</p>
            <ion-button size="small" class="je-btn-gradient" routerLink="/customer/tabs/events">
              Browse packages
            </ion-button>
          </div>
        }

        <!-- Quick actions ---------------------------------------------- -->
        <div class="actions">
          @for (action of quickActions; track action.route) {
            <a class="action" [routerLink]="action.route">
              <span class="action__icon" [style.background]="action.tint">
                <ion-icon [name]="action.icon" />
              </span>
              <span class="action__label">{{ action.label }}</span>
            </a>
          }
        </div>

        <!-- Stats -------------------------------------------------------- -->
        <div class="je-grid-3 stats">
          <div class="je-stat">
            <div class="je-stat__value">{{ bookings().length }}</div>
            <div class="je-stat__label">Bookings</div>
          </div>
          <div class="je-stat">
            <div class="je-stat__value">{{ profile()?.loyaltyPoints ?? 0 }}</div>
            <div class="je-stat__label">Reward points</div>
          </div>
          <div class="je-stat">
            <div class="je-stat__value">{{ openQuotes().length }}</div>
            <div class="je-stat__label">Open quotes</div>
          </div>
        </div>

        <!-- Categories ---------------------------------------------------- -->
        <div class="je-section-head">
          <h2>Plan an event</h2>
          <a routerLink="/customer/tabs/events">See all</a>
        </div>
        <div class="cats">
          @for (category of categories(); track category.id) {
            <a class="cat" [routerLink]="['/customer/tabs/events']" [queryParams]="{ category: category.id }">
              <span class="cat__art" [style.background]="category.gradient">
                <ion-icon name="sparkles" />
              </span>
              <span class="cat__name je-truncate">{{ category.name }}</span>
              @if (category.startingPrice) {
                <span class="cat__price je-xs je-soft">from {{ category.startingPrice | inr: true }}</span>
              }
            </a>
          } @empty {
            <p class="je-sm je-muted">Categories will appear once the catalogue loads.</p>
          }
        </div>

        <!-- Recent bookings ------------------------------------------------ -->
        @if (recentBookings().length) {
          <div class="je-section-head">
            <h2>Recent bookings</h2>
            <a routerLink="/customer/tabs/bookings">See all</a>
          </div>
          @for (booking of recentBookings(); track booking.id) {
            <a class="je-card row" [routerLink]="['/customer/booking', booking.id]">
              <div class="row__body">
                <strong class="je-truncate">{{ booking.eventName }}</strong>
                <span class="je-xs je-muted">
                  {{ booking.eventDate | date: 'd MMM y' }} · {{ booking.vendorName || 'Vendor pending' }}
                </span>
                <app-status-pill [status]="booking.status" />
              </div>
              <div class="row__end">
                <span class="je-price">{{ booking.totalAmount | inr: true }}</span>
                <ion-icon name="chevron-forward" color="medium" />
              </div>
            </a>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .greet { display: flex; flex-direction: column; padding-left: 16px; line-height: 1.25; }
    .greet strong { font-family: var(--je-font-heading); font-size: var(--je-fs-md); }
    .dot { position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 2px 5px; }

    .next { display: block; border-radius: var(--je-radius-lg); padding: 20px; text-decoration: none;
            box-shadow: 0 12px 28px rgba(255, 107, 53, 0.28); margin-top: 6px; }
    .next__top { display: flex; align-items: center; justify-content: space-between; }
    .next__label { font-size: var(--je-fs-xs); text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
    .next__days { font-size: var(--je-fs-xs); font-weight: 700; background: rgba(255,255,255,0.22);
                  padding: 3px 9px; border-radius: var(--je-radius-full); }
    .next h2 { font-size: var(--je-fs-xl); margin: 10px 0 12px; }
    .next__meta { display: flex; align-items: center; gap: 7px; margin: 0 0 5px;
                  font-size: var(--je-fs-sm); opacity: 0.94; }
    .next__foot { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
    .next__foot .je-pill { background: rgba(255,255,255,0.22); color: #fff; }
    .next__amount { font-family: var(--je-font-heading); font-weight: 700; font-size: var(--je-fs-md); }

    .empty-next { text-align: center; padding: 26px 20px; }
    .empty-next h3 { font-size: var(--je-fs-md); margin: 0 0 6px; }
    .empty-next p { margin: 0 0 14px; }

    .actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 20px 0 4px; }
    .action { display: flex; flex-direction: column; align-items: center; gap: 7px; text-decoration: none; }
    .action__icon { width: 48px; height: 48px; display: grid; place-items: center;
                    border-radius: var(--je-radius-md); color: #fff; }
    .action__icon ion-icon { font-size: 21px; }
    .action__label { font-size: var(--je-fs-xs); color: var(--je-text-muted); font-weight: 600; text-align: center; }

    .stats { margin-top: 20px; }

    .cats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .cat { display: flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; }
    .cat__art { width: 56px; height: 56px; display: grid; place-items: center;
                border-radius: var(--je-radius-md); color: #fff; }
    .cat__art ion-icon { font-size: 23px; }
    .cat__name { font-size: var(--je-fs-xs); font-weight: 600; color: var(--je-text-main);
                 max-width: 100%; text-align: center; }
    .cat__price { text-align: center; }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; text-decoration: none; }
    .row__body { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; min-width: 0; flex: 1; }
    .row__body strong { font-size: var(--je-fs-base); color: var(--je-text-main); max-width: 100%; }
    .row__end { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  `]
})
export class CustomerDashboardPage implements OnInit {
  auth = inject(AuthService);
  notifications = inject(NotificationService);
  private dashboard = inject(DashboardService);
  private router = inject(Router);

  readonly loading = signal(true);
  readonly profile = signal<CustomerProfile | null>(null);
  readonly bookings = signal<Booking[]>([]);
  readonly categories = signal<EventType[]>([]);
  readonly quotes = signal<EventRfp[]>([]);

  readonly quickActions = [
    { label: 'Get quotes', icon: 'chatbubble-ellipses', route: '/customer/quotes', tint: 'linear-gradient(135deg,#6B21A8,#9333EA)' },
    { label: 'Payments', icon: 'card', route: '/customer/payments', tint: 'linear-gradient(135deg,#0EA5E9,#38BDF8)' },
    { label: 'Rewards', icon: 'gift', route: '/customer/rewards', tint: 'linear-gradient(135deg,#F59E0B,#FBBF24)' },
    { label: 'Support', icon: 'help-buoy', route: '/customer/support', tint: 'linear-gradient(135deg,#16A34A,#4ADE80)' }
  ];

  ngOnInit(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.dashboard.getCustomerDashboard().subscribe(data => {
      this.profile.set(data.profile);
      this.bookings.set(data.bookings);
      this.categories.set(data.categories.slice(0, 8));
      this.quotes.set(data.rfps);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  /** The soonest future booking that has not been cancelled. */
  nextBooking(): Booking | null {
    const upcoming = this.bookings()
      .filter(b => new Date(b.eventDate).getTime() >= Date.now())
      .filter(b => !['cancelled', 'rejected'].includes(b.status))
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    return upcoming[0] ?? null;
  }

  recentBookings(): Booking[] {
    return [...this.bookings()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }

  openQuotes(): EventRfp[] {
    return this.quotes().filter(q => String(q.status).toLowerCase() === 'open');
  }

  daysAway(date: string): string {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  }
}
