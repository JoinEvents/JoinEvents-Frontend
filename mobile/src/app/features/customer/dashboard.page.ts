import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ViewWillEnter } from '@ionic/angular';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonBadge,
  IonRefresher, IonRefresherContent, IonFab, IonFabButton
} from '@ionic/angular/standalone';

import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MessengerService } from '../../core/services/messenger.service';
import { Booking } from '../../core/models/booking.model';
import { CustomerProfile } from '../../core/models/user.model';
import { RealtimeService } from '../../core/services/realtime.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

interface Todo {
  key: string;
  title: string;
  detail: string;
  icon: string;
  tone: 'pay' | 'wait' | 'review';
  link: (string | number)[];
}

/**
 * Customer home, laid out like the support work queue: the next event (or a welcome), four
 * numbers at a glance that each open their screen, anything that needs the customer, and a
 * "Jump to" list for everything else. Roshi stays as the floating button.
 */
@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonBadge,
    IonRefresher, IonRefresherContent, IonFab, IonFabButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Home</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/customer/notifications" aria-label="Notifications">
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
        <!-- Hero: the next event, or a welcome ------------------------------------ -->
        @if (nextBooking(); as booking) {
          <a class="hello je-gradient" [routerLink]="['/customer/booking', booking.id]">
            <span class="hello__label">Your next event · {{ daysAway(booking.eventDate) }}</span>
            <strong class="hello__name">{{ booking.eventName }}</strong>
            <span class="hello__sub">{{ booking.eventDate | date: 'EEE, d MMM' }} · {{ place(booking) }}</span>
            <span class="hello__step"><ion-icon [name]="nextStep(booking).icon" /> {{ nextStep(booking).text }}</span>
          </a>
        } @else {
          <a class="hello je-gradient" routerLink="/customer/tabs/events">
            <span class="hello__label">{{ greeting() }}</span>
            <strong class="hello__name hello__name--person">{{ firstName() }}</strong>
            <span class="hello__sub">Plan your next celebration <ion-icon name="arrow-forward" /></span>
          </a>
        }

        <!-- At a glance ------------------------------------------------------------ -->
        <div class="je-grid-2 stats">
          <a class="je-stat" routerLink="/customer/tabs/bookings">
            <div class="je-stat__value">{{ loading() ? '–' : upcomingCount() }}</div>
            <div class="je-stat__label">Upcoming events</div>
          </a>
          <a class="je-stat" routerLink="/customer/payments">
            <div class="je-stat__value">{{ loading() ? '–' : (amountDue() | inr: true) }}</div>
            <div class="je-stat__label">Amount due</div>
          </a>
          <a class="je-stat" routerLink="/customer/rewards">
            <div class="je-stat__value">{{ (profile()?.loyaltyPoints ?? 0) | number }}</div>
            <div class="je-stat__label">Reward points</div>
          </a>
          <a class="je-stat" routerLink="/customer/tabs/messages">
            <div class="je-stat__value">{{ messenger.totalUnread() }}</div>
            <div class="je-stat__label">Unread messages</div>
          </a>
        </div>

        <!-- Only when something needs the customer ----------------------------------- -->
        @if (!loading() && todos().length) {
          <div class="je-section-head"><h2>Needs your attention</h2></div>
          @for (todo of todos(); track todo.key) {
            <a class="je-card queue" [routerLink]="todo.link">
              <span class="queue__icon" [style.background]="tints[todo.tone]"><ion-icon [name]="todo.icon" /></span>
              <div class="queue__body">
                <strong class="je-sm">{{ todo.title }}</strong>
                <span class="je-xs je-muted">{{ todo.detail }}</span>
              </div>
              <ion-icon name="chevron-forward" color="medium" />
            </a>
          }
        }

        <!-- Everything else, one tap away --------------------------------------------- -->
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
      </div>

      <!-- Room for the Roshi button, so it never covers the last card -->
      <div class="fab-space"></div>

      <!-- Roshi, the event concierge -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end" class="roshi-fab">
        <ion-fab-button routerLink="/customer/roshi" aria-label="Ask Roshi, your event concierge">
          <ion-icon name="sparkles" />
        </ion-fab-button>
        <span class="roshi-fab__label">Ask Roshi</span>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .dot { position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 2px 5px; }
    .hello { display: block; border-radius: var(--je-radius-lg); padding: 20px; margin-top: 6px; text-decoration: none;
             box-shadow: 0 12px 28px rgba(255, 107, 53, 0.28); }
    .hello__label { font-size: var(--je-fs-xs); text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
    .hello__name { display: block; font-family: var(--je-font-heading); font-size: var(--je-fs-xl);
                   font-weight: 700; margin: 4px 0 2px; }
    .hello__name--person { text-transform: capitalize; }
    .hello__sub { display: flex; align-items: center; gap: 6px; font-size: var(--je-fs-sm); opacity: 0.9; }
    .hello__step { display: flex; align-items: center; gap: 7px; margin-top: 14px; padding-top: 12px;
                   border-top: 1px solid rgba(255, 255, 255, 0.25); font-size: var(--je-fs-sm); font-weight: 600; }
    .stats { margin-top: 18px; }
    .stats a { text-decoration: none; display: block; }
    .queue { display: flex; align-items: center; gap: 13px; text-decoration: none; }
    .queue__icon { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
                   border-radius: var(--je-radius-sm); color: #fff; }
    .queue__icon ion-icon { font-size: 19px; }
    .queue__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .fab-space { height: 76px; }
    .roshi-fab { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .roshi-fab ion-fab-button { --background: var(--je-gradient-primary); --background-activated: var(--je-gradient-primary);
                                --box-shadow: 0 10px 24px rgba(217, 70, 239, 0.35); }
    .roshi-fab__label { font-size: 10px; font-weight: 700; color: var(--je-text-main); background: var(--je-bg-card);
                        padding: 2px 8px; border-radius: var(--je-radius-full); box-shadow: var(--je-shadow-sm); }
    .greet { display: flex; flex-direction: column; padding-left: 16px; line-height: 1.25; }
  `]
})
export class CustomerDashboardPage implements OnInit, ViewWillEnter {
  auth = inject(AuthService);
  notifications = inject(NotificationService);
  private dashboard = inject(DashboardService);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  messenger = inject(MessengerService);

  readonly loading = signal(true);
  readonly profile = signal<CustomerProfile | null>(null);
  readonly bookings = signal<Booking[]>([]);

  /** The soonest event still ahead that hasn't been cancelled. */
  readonly nextBooking = computed<Booking | null>(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.bookings()
      .filter(b => new Date(b.eventDate).getTime() >= today)
      .filter(b => !CLOSED.includes(b.status))
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0] ?? null;
  });

  /**
   * What needs the customer, soonest first: unpaid bookings, balances due, and finished events
   * to review. The next event is left out; its card already says what to do.
   */
  readonly todos = computed<Todo[]>(() => {
    const nextId = this.nextBooking()?.id;
    const today = new Date().setHours(0, 0, 0, 0);
    const items: (Todo & { at: number })[] = [];
    for (const b of this.bookings()) {
      if (b.id === nextId) continue;
      const at = new Date(b.eventDate).getTime();
      const name = b.eventName || 'your event';
      if (b.status === 'pending' && at >= today) {
        items.push({ key: `pay-${b.id}`, at, tone: 'pay', icon: 'card-outline', title: `Pay for ${name}`,
          detail: 'Pay the advance to lock the date', link: ['/customer/checkout', b.id] });
      } else if (['confirmed', 'in_progress', 'completed'].includes(b.status) && (b.balanceDue ?? 0) > 0) {
        items.push({ key: `due-${b.id}`, at, tone: 'pay', icon: 'wallet-outline', title: `${money(b.balanceDue!)} due`,
          detail: `Balance for ${name}`, link: ['/customer/booking', b.id] });
      } else if (['completed', 'settled'].includes(b.status) && !b.review) {
        items.push({ key: `review-${b.id}`, at, tone: 'review', icon: 'star-outline', title: `How was ${name}?`,
          detail: 'Leave a review and earn 50 points', link: ['/customer/booking', b.id] });
      }
    }
    return items.sort((a, b) => a.at - b.at).slice(0, 3);
  });

  /** Everything else a customer needs, one tap away (the same pattern as the support queue). */
  readonly shortcuts = [
    { label: 'Browse packages', detail: 'Venues, catering, decor and more', icon: 'sparkles', route: '/customer/tabs/events', tint: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
    { label: 'My bookings', detail: 'Status, payments and invoices', icon: 'journal', route: '/customer/tabs/bookings', tint: 'linear-gradient(135deg,#0EA5E9,#38BDF8)' },
    { label: 'Get quotes', detail: 'Describe your event, compare vendor offers', icon: 'chatbubble-ellipses', route: '/customer/quotes', tint: 'linear-gradient(135deg,#6B21A8,#9333EA)' },
    { label: 'Saved packages', detail: 'Packages you liked', icon: 'heart', route: '/customer/favorites', tint: 'linear-gradient(135deg,#E91E8C,#FF6B9D)' },
    { label: 'Help & support', detail: 'Raise a ticket or track one', icon: 'help-buoy', route: '/customer/support', tint: 'linear-gradient(135deg,#16A34A,#4ADE80)' }
  ];

  readonly tints: Record<Todo['tone'], string> = {
    pay: 'linear-gradient(135deg,#FF6B35,#FF8C5A)',
    wait: 'linear-gradient(135deg,#0EA5E9,#38BDF8)',
    review: 'linear-gradient(135deg,#F59E0B,#FBBF24)'
  };

  /** Events still ahead that haven't been cancelled or finished. */
  readonly upcomingCount = computed(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.bookings().filter(b => !CLOSED.includes(b.status) && new Date(b.eventDate).getTime() >= today).length;
  });

  /** What is still owed across bookings that are going ahead (unpaid bookings are due in full). */
  readonly amountDue = computed(() => this.bookings()
    .filter(b => !['cancelled', 'rejected'].includes(b.status))
    .reduce((sum, b) => sum + (b.balanceDue ?? (b.status === 'pending' ? b.totalAmount : 0)), 0));

  private loaded = false;

  ngOnInit(): void {
    // A booking confirmed, paid or cancelled elsewhere changes what this screen shows.
    this.realtime.notifications$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  /** Home is a tab that stays alive, so refresh whenever it is shown again. */
  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    // Skeletons only on the first load; later refreshes update in place.
    if (!this.loaded) this.loading.set(true);
    this.messenger.getThreads().subscribe();
    this.dashboard.getCustomerDashboard().subscribe(data => {
      this.profile.set(data.profile);
      this.bookings.set(data.bookings);
      this.loading.set(false);
      this.loaded = true;
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  /** The one thing to know about the next event, from its status. */
  nextStep(b: Booking): { icon: string; text: string } {
    switch (b.status) {
      case 'pending': return { icon: 'card-outline', text: 'Pay the advance to lock your date' };
      case 'advance_paid': return { icon: 'time-outline', text: 'Paid · waiting for the vendor to confirm' };
      case 'in_progress': return { icon: 'sparkles-outline', text: 'Happening now. Enjoy!' };
      case 'disputed': return { icon: 'shield-outline', text: 'Support is looking into this booking' };
      default:
        return (b.balanceDue ?? 0) > 0
          ? { icon: 'checkmark-circle-outline', text: `Confirmed · ${money(b.balanceDue!)} balance due` }
          : { icon: 'checkmark-circle-outline', text: 'Confirmed · message your vendor anytime' };
    }
  }

  /** Where the event is, briefly: the city, or the venue when there's no city. */
  place(booking: Booking): string {
    return (booking.city || '').trim() || (booking.venue || '').trim() || 'Venue to be confirmed';
  }

  daysAway(date: string): string {
    const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  firstName(): string {
    return (this.auth.currentUser()?.name || '').trim().split(/\s+/)[0] || 'there';
  }

  greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  }
}

const CLOSED = ['cancelled', 'rejected', 'completed', 'settled'];

function money(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN');
}
