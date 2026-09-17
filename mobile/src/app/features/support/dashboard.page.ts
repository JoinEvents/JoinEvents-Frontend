import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonBadge,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { SupportService } from '../../core/services/support.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

/** Agent work queue — what is waiting, and how the team is keeping up. */
@Component({
  selector: 'app-support-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonBadge,
    IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Work queue</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/support/notifications">
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
        <div class="hello je-gradient">
          <span class="hello__label">Signed in as</span>
          <strong class="hello__name">{{ auth.currentUser()?.name }}</strong>
          <span class="hello__sub">Support agent</span>
        </div>

        <div class="je-grid-2 stats">
          <a class="je-stat" routerLink="/support/tabs/tickets">
            <div class="je-stat__value">{{ stat('openTickets') }}</div>
            <div class="je-stat__label">Open tickets</div>
          </a>
          <a class="je-stat" routerLink="/support/tabs/verifications">
            <div class="je-stat__value">{{ stat('pendingVerifications') }}</div>
            <div class="je-stat__label">Pending verifications</div>
          </a>
          <a class="je-stat" routerLink="/support/reviews">
            <div class="je-stat__value">{{ stat('flaggedReviews') }}</div>
            <div class="je-stat__label">Flagged reviews</div>
          </a>
          <a class="je-stat" routerLink="/support/tabs/bookings">
            <div class="je-stat__value">{{ stat('activeDisputes') }}</div>
            <div class="je-stat__label">Active disputes</div>
          </a>
        </div>

        <div class="je-section-head"><h2>Jump to</h2></div>
        @for (shortcut of shortcuts; track shortcut.route) {
          <a class="je-card queue" [routerLink]="shortcut.route">
            <span class="queue__icon" [style.background]="shortcut.tint">
              <ion-icon [name]="shortcut.icon" />
            </span>
            <div class="queue__body">
              <strong class="je-sm">{{ shortcut.label }}</strong>
              <span class="je-xs je-muted">{{ shortcut.detail }}</span>
            </div>
            <ion-icon name="chevron-forward" color="medium" />
          </a>
        }

        @if (stat('avgResponseHours')) {
          <div class="je-card sla">
            <ion-icon name="timer-outline" color="primary" />
            <div>
              <strong class="je-sm">Average first response</strong>
              <p class="je-xs je-muted">{{ stat('avgResponseHours') }} hours across the team this week</p>
            </div>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .dot { position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 2px 5px; }
    .hello { border-radius: var(--je-radius-lg); padding: 20px; margin-top: 6px;
             box-shadow: 0 12px 28px rgba(255, 107, 53, 0.28); }
    .hello__label { font-size: var(--je-fs-xs); text-transform: uppercase;
                    letter-spacing: 0.08em; opacity: 0.85; }
    .hello__name { display: block; font-family: var(--je-font-heading);
                   font-size: var(--je-fs-xl); font-weight: 700; margin: 4px 0 2px; }
    .hello__sub { font-size: var(--je-fs-sm); opacity: 0.9; }
    .stats { margin-top: 18px; }
    .stats a { text-decoration: none; display: block; }
    .queue { display: flex; align-items: center; gap: 13px; text-decoration: none; }
    .queue__icon { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
                   border-radius: var(--je-radius-sm); color: #fff; }
    .queue__icon ion-icon { font-size: 19px; }
    .queue__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .sla { display: flex; align-items: center; gap: 13px; }
    .sla ion-icon { font-size: 24px; flex-shrink: 0; }
    .sla p { margin: 3px 0 0; }
  `]
})
export class SupportDashboardPage implements ViewWillEnter {
  auth = inject(AuthService);
  notifications = inject(NotificationService);
  private supportService = inject(SupportService);

  readonly stats = signal<Record<string, unknown> | null>(null);

  readonly shortcuts = [
    { label: 'Ticket inbox', detail: 'Reply to customer and vendor issues', icon: 'ticket', route: '/support/tabs/tickets', tint: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
    { label: 'Verification queue', detail: 'Approve vendors and packages', icon: 'shield-checkmark', route: '/support/tabs/verifications', tint: 'linear-gradient(135deg,#6B21A8,#9333EA)' },
    { label: 'Booking monitor', detail: 'Track and intervene on live bookings', icon: 'journal', route: '/support/tabs/bookings', tint: 'linear-gradient(135deg,#0EA5E9,#38BDF8)' },
    { label: 'Review moderation', detail: 'Keep or remove flagged reviews', icon: 'chatbox-ellipses', route: '/support/reviews', tint: 'linear-gradient(135deg,#16A34A,#4ADE80)' },
    { label: 'Directory', detail: 'Look up a customer or vendor', icon: 'people', route: '/support/directory', tint: 'linear-gradient(135deg,#475569,#94A3B8)' }
  ];

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.supportService.getDashboardStats().subscribe(stats => {
      this.stats.set(stats);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  /** Reads a stat by any of the shapes the API has used, defaulting to zero. */
  stat(key: string): number {
    const stats = this.stats();
    if (!stats) return 0;
    const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    return Number(stats[key] ?? stats[snake] ?? 0);
  }
}
