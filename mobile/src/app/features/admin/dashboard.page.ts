import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonBadge,
  IonRefresher, IonRefresherContent, IonSkeletonText
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { AdminService, AdminOverview } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

/** Platform health at a glance, plus whatever is queued for a human decision. */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink, CurrencyInrPipe, TimeAgoPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonBadge,
    IonRefresher, IonRefresherContent, IonSkeletonText
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Overview</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/admin/notifications">
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
        } @else if (overview(); as o) {
          <!-- GMV --------------------------------------------------- -->
          <div class="gmv je-gradient">
            <span class="gmv__label">Gross booking value</span>
            <strong class="gmv__value">{{ o.grossBookingValue | inr }}</strong>
            <div class="gmv__meta">
              <span><ion-icon name="cash-outline" /> {{ o.platformRevenue | inr: true }} platform revenue</span>
            </div>
          </div>

          <!-- Core stats ---------------------------------------------- -->
          <div class="je-grid-2 stats">
            <a class="je-stat" routerLink="/admin/tabs/directory">
              <div class="je-stat__value">{{ o.totalCustomers }}</div>
              <div class="je-stat__label">Customers</div>
            </a>
            <a class="je-stat" routerLink="/admin/tabs/directory">
              <div class="je-stat__value">{{ o.totalVendors }}</div>
              <div class="je-stat__label">Vendors</div>
            </a>
            <a class="je-stat" routerLink="/admin/tabs/bookings">
              <div class="je-stat__value">{{ o.totalBookings }}</div>
              <div class="je-stat__label">Bookings</div>
            </a>
            <a class="je-stat" routerLink="/admin/tabs/catalogue">
              <div class="je-stat__value">{{ o.activePackages }}</div>
              <div class="je-stat__label">Live packages</div>
            </a>
          </div>

          <!-- Queues ----------------------------------------------------- -->
          <div class="je-section-head"><h2>Needs a decision</h2></div>
          <a class="je-card queue" routerLink="/admin/verifications">
            <span class="queue__icon queue__icon--warn"><ion-icon name="shield-half-outline" /></span>
            <div class="queue__body">
              <strong class="je-sm">Vendor verifications</strong>
              <span class="je-xs je-muted">{{ pendingVendors().length }} waiting for review</span>
            </div>
            <ion-icon name="chevron-forward" color="medium" />
          </a>

          <a class="je-card queue" routerLink="/admin/disputes">
            <span class="queue__icon queue__icon--danger"><ion-icon name="alert-circle-outline" /></span>
            <div class="queue__body">
              <strong class="je-sm">Disputes &amp; flagged reviews</strong>
              <span class="je-xs je-muted">{{ o.openDisputes }} open</span>
            </div>
            <ion-icon name="chevron-forward" color="medium" />
          </a>
        }

        <!-- Recent activity ------------------------------------------------ -->
        @if (auditLogs().length) {
          <div class="je-section-head">
            <h2>Recent activity</h2>
            <a routerLink="/admin/audit">Full trail</a>
          </div>
          @for (log of auditLogs().slice(0, 6); track $index) {
            <div class="je-card log">
              <span class="log__dot"></span>
              <div class="log__body">
                <strong class="je-sm je-clamp-2">{{ log['action'] || log['description'] }}</strong>
                <span class="je-xs je-muted">
                  {{ log['actor'] || log['userName'] || 'System' }} · {{ $any(log['timestamp'] || log['createdAt']) | timeAgo }}
                </span>
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .dot { position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 2px 5px; }
    .gmv { border-radius: var(--je-radius-lg); padding: 22px 20px; margin-top: 6px;
           box-shadow: 0 12px 28px rgba(255, 107, 53, 0.28); }
    .gmv__label { font-size: var(--je-fs-xs); text-transform: uppercase;
                  letter-spacing: 0.08em; opacity: 0.85; }
    .gmv__value { display: block; font-family: var(--je-font-heading);
                  font-size: 32px; font-weight: 700; line-height: 1.2; margin: 6px 0 12px; }
    .gmv__meta span { display: inline-flex; align-items: center; gap: 6px;
                      font-size: var(--je-fs-sm); opacity: 0.94; }
    .stats a { text-decoration: none; display: block; }
    .queue { display: flex; align-items: center; gap: 13px; text-decoration: none; }
    .queue__icon { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
                   border-radius: var(--je-radius-sm); }
    .queue__icon ion-icon { font-size: 19px; }
    .queue__icon--warn { background: rgba(217,119,6,0.12); color: var(--je-warning); }
    .queue__icon--danger { background: rgba(220,38,38,0.12); color: var(--je-danger); }
    .queue__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .log { display: flex; gap: 12px; align-items: flex-start; }
    .log__dot { width: 8px; height: 8px; margin-top: 6px; flex-shrink: 0;
                border-radius: 50%; background: var(--je-primary); }
    .log__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  `]
})
export class AdminDashboardPage implements ViewWillEnter {
  notifications = inject(NotificationService);
  private adminService = inject(AdminService);

  readonly loading = signal(true);
  readonly overview = signal<AdminOverview | null>(null);
  readonly pendingVendors = signal<Record<string, unknown>[]>([]);
  readonly auditLogs = signal<Record<string, unknown>[]>([]);

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.adminService.getDashboardBundle().subscribe(bundle => {
      this.overview.set(bundle.overview);
      this.pendingVendors.set(bundle.pendingVendors);
      this.auditLogs.set(bundle.auditLogs);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }
}
