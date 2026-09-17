import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonBadge,
  IonRefresher, IonRefresherContent, IonSkeletonText, IonProgressBar
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { VendorService, VendorDashboardData } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

/**
 * Vendor home. Leads with the numbers a vendor checks between jobs — pending
 * requests, this month's revenue, rating — then the tasks that need action.
 */
@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonBadge,
    IonRefresher, IonRefresherContent, IonSkeletonText, IonProgressBar
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="greet" slot="start">
          <span class="je-xs je-muted">Welcome back</span>
          <strong class="je-truncate">{{ auth.currentUser()?.name }}</strong>
        </div>
        <ion-buttons slot="end">
          <ion-button routerLink="/vendor/calendar">
            <ion-icon slot="icon-only" name="calendar-outline" />
          </ion-button>
          <ion-button routerLink="/vendor/notifications">
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
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <div class="je-card">
            <ion-skeleton-text [animated]="true" style="width: 40%; height: 13px;" />
            <ion-skeleton-text [animated]="true" style="width: 70%; height: 26px; margin-top: 12px;" />
          </div>
        } @else if (data(); as d) {
          <!-- Revenue --------------------------------------------------- -->
          <div class="revenue je-gradient">
            <span class="revenue__label">Revenue this month</span>
            <strong class="revenue__value">{{ d.monthlyRevenue | inr }}</strong>
            <div class="revenue__meta">
              <span><ion-icon name="journal-outline" /> {{ d.totalBookings }} bookings</span>
              <span><ion-icon name="star" /> {{ d.rating | number: '1.1-1' }} ({{ d.totalReviews }})</span>
            </div>
          </div>

          <!-- Verification nudge ----------------------------------------- -->
          @if (d.verificationStatus !== 'verified') {
            <a class="je-card alert" routerLink="/vendor/verification">
              <ion-icon name="shield-half-outline" color="warning" />
              <div class="alert__body">
                <strong class="je-sm">Finish your verification</strong>
                <span class="je-xs je-muted">
                  Verified vendors appear higher in search and can accept bookings.
                </span>
              </div>
              <ion-icon name="chevron-forward" color="medium" />
            </a>
          }

          <!-- Profile completion ------------------------------------------- -->
          @if (d.profileCompletion < 100) {
            <div class="je-card completion">
              <div class="completion__head">
                <strong class="je-sm">Profile {{ d.profileCompletion }}% complete</strong>
                <span class="je-xs je-muted">A complete profile wins more bookings</span>
              </div>
              <ion-progress-bar [value]="d.profileCompletion / 100" color="primary" />
            </div>
          }

          <!-- Stats ---------------------------------------------------------- -->
          <div class="je-grid-2 stats">
            <a class="je-stat" routerLink="/vendor/tabs/bookings">
              <div class="je-stat__value">{{ d.pendingRequests }}</div>
              <div class="je-stat__label">Pending requests</div>
            </a>
            <a class="je-stat" routerLink="/vendor/tabs/packages">
              <div class="je-stat__value">{{ d.activePackages }}</div>
              <div class="je-stat__label">Active packages</div>
            </a>
          </div>

          <!-- Quick actions ---------------------------------------------------- -->
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

          <!-- Upcoming events --------------------------------------------------- -->
          @if (d.upcomingEvents.length) {
            <div class="je-section-head"><h2>Coming up</h2></div>
            @for (event of d.upcomingEvents; track event.id) {
              <a class="je-card row" [routerLink]="['/vendor/tabs/bookings']">
                <div class="date">
                  <span class="date__day">{{ event.date | date: 'd' }}</span>
                  <span class="date__mon">{{ event.date | date: 'MMM' }}</span>
                </div>
                <div class="row__body">
                  <strong class="je-sm je-truncate">{{ event.name }}</strong>
                  <span class="je-xs je-muted je-truncate">{{ event.customerName }}</span>
                </div>
                <ion-icon name="chevron-forward" color="medium" />
              </a>
            }
          }
        }

        <!-- Tasks ------------------------------------------------------------- -->
        @if (tasks().length) {
          <div class="je-section-head"><h2>Needs your attention</h2></div>
          @for (task of tasks(); track task.id) {
            <div class="je-card task">
              <ion-icon name="alert-circle" color="warning" />
              <div class="task__body">
                <strong class="je-sm">{{ task.title }}</strong>
                @if (task.description) { <span class="je-xs je-muted">{{ task.description }}</span> }
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .greet { display: flex; flex-direction: column; padding-left: 16px; line-height: 1.25; max-width: 60vw; }
    .greet strong { font-family: var(--je-font-heading); font-size: var(--je-fs-md); }
    .dot { position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 2px 5px; }

    .revenue { border-radius: var(--je-radius-lg); padding: 22px 20px; margin-top: 6px;
               box-shadow: 0 12px 28px rgba(255, 107, 53, 0.28); }
    .revenue__label { font-size: var(--je-fs-xs); text-transform: uppercase;
                      letter-spacing: 0.08em; opacity: 0.85; }
    .revenue__value { display: block; font-family: var(--je-font-heading);
                      font-size: 32px; font-weight: 700; line-height: 1.2; margin: 6px 0 14px; }
    .revenue__meta { display: flex; gap: 18px; font-size: var(--je-fs-sm); opacity: 0.94; }
    .revenue__meta span { display: inline-flex; align-items: center; gap: 6px; }

    .alert { display: flex; align-items: center; gap: 12px; text-decoration: none;
             border-color: rgba(217, 119, 6, 0.3); background: rgba(217, 119, 6, 0.06); }
    .alert > ion-icon:first-child { font-size: 24px; flex-shrink: 0; }
    .alert__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }

    .completion__head { display: flex; flex-direction: column; gap: 3px; margin-bottom: 10px; }
    .completion ion-progress-bar { height: 6px; border-radius: 3px; }

    .stats a { text-decoration: none; display: block; }

    .actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 20px 0 4px; }
    .action { display: flex; flex-direction: column; align-items: center; gap: 7px; text-decoration: none; }
    .action__icon { width: 48px; height: 48px; display: grid; place-items: center;
                    border-radius: var(--je-radius-md); color: #fff; }
    .action__icon ion-icon { font-size: 21px; }
    .action__label { font-size: var(--je-fs-xs); color: var(--je-text-muted);
                     font-weight: 600; text-align: center; }

    .row { display: flex; align-items: center; gap: 14px; text-decoration: none; }
    .date { width: 46px; flex-shrink: 0; text-align: center; padding: 7px 0;
            border-radius: var(--je-radius-sm); background: var(--je-bg-light); }
    .date__day { display: block; font-family: var(--je-font-heading);
                 font-weight: 700; font-size: var(--je-fs-md); line-height: 1; }
    .date__mon { display: block; font-size: 10px; text-transform: uppercase;
                 color: var(--je-text-muted); margin-top: 2px; }
    .row__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }

    .task { display: flex; align-items: center; gap: 12px; }
    .task ion-icon { font-size: 21px; flex-shrink: 0; }
    .task__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  `]
})
export class VendorDashboardPage implements ViewWillEnter {
  auth = inject(AuthService);
  notifications = inject(NotificationService);
  private vendorService = inject(VendorService);

  readonly loading = signal(true);
  readonly data = signal<VendorDashboardData | null>(null);
  readonly tasks = signal<{ id: string; title: string; description?: string; link?: string }[]>([]);

  readonly quickActions = [
    { label: 'Add package', icon: 'add-circle', route: '/vendor/package/new', tint: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
    { label: 'Calendar', icon: 'calendar', route: '/vendor/calendar', tint: 'linear-gradient(135deg,#6B21A8,#9333EA)' },
    { label: 'Messages', icon: 'chatbubbles', route: '/vendor/messages', tint: 'linear-gradient(135deg,#0EA5E9,#38BDF8)' },
    { label: 'Finance', icon: 'wallet', route: '/vendor/finance', tint: 'linear-gradient(135deg,#16A34A,#4ADE80)' }
  ];

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.vendorService.getDashboard().subscribe(data => {
      this.data.set(data);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
    this.vendorService.getDashboardTasks().subscribe(tasks => this.tasks.set(tasks));
  }
}
