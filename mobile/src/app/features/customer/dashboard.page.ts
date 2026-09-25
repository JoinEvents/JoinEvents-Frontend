import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ViewWillEnter } from '@ionic/angular';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonBadge,
  IonRefresher, IonRefresherContent, IonSkeletonText
} from '@ionic/angular/standalone';

import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Booking } from '../../core/models/booking.model';
import { EventType } from '../../core/models/event.model';
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
 * Customer home, kept to what people open the app for: their next event and its next step,
 * anything that needs them (pay, review), and a way to start planning. Everything else
 * (quotes, payments, rewards, saved packages, support) lives in Profile; bookings in their tab.
 */
@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonBadge,
    IonRefresher, IonRefresherContent, IonSkeletonText
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="greet" slot="start">
          <span class="je-xs je-muted">{{ greeting() }}</span>
          <strong>{{ firstName() }}</strong>
        </div>
        <ion-buttons slot="end">
          @if (profile()?.loyaltyPoints) {
            <a class="points" routerLink="/customer/rewards" aria-label="Reward points">
              <ion-icon name="gift" /> {{ profile()!.loyaltyPoints | number }}
            </a>
          }
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

      <div class="je-section home">
        <!-- 1. The one thing people open the app to check ------------------ -->
        @if (loading()) {
          <div class="je-card">
            <ion-skeleton-text [animated]="true" style="width: 40%; height: 12px;" />
            <ion-skeleton-text [animated]="true" style="width: 70%; height: 22px; margin-top: 12px;" />
            <ion-skeleton-text [animated]="true" style="width: 55%; height: 12px;" />
          </div>
        } @else if (nextBooking(); as booking) {
          <a class="next je-gradient" [routerLink]="['/customer/booking', booking.id]">
            <div class="next__top">
              <span class="next__label">Your next event</span>
              <span class="next__days">{{ daysAway(booking.eventDate) }}</span>
            </div>
            <h2>{{ booking.eventName }}</h2>
            <p class="next__meta">{{ booking.eventDate | date: 'EEE, d MMM' }} · {{ place(booking) }}</p>
            <p class="next__step">
              <ion-icon [name]="nextStep(booking).icon" /> {{ nextStep(booking).text }}
            </p>
          </a>
        } @else {
          <a class="start" routerLink="/customer/tabs/events">
            <span class="start__text">
              <strong>What are you celebrating?</strong>
              <span class="je-sm je-muted">Find a package in minutes</span>
            </span>
            <span class="start__go"><ion-icon name="search" /></span>
          </a>
        }

        <!-- 2. Only what needs the customer, only when it does --------------- -->
        @if (!loading() && todos().length) {
          <h2 class="head">To do</h2>
          <div class="list">
            @for (todo of todos(); track todo.key) {
              <a class="todo" [routerLink]="todo.link">
                <span class="todo__icon" [class]="'todo__icon--' + todo.tone"><ion-icon [name]="todo.icon" /></span>
                <span class="todo__text">
                  <strong class="je-truncate">{{ todo.title }}</strong>
                  <span class="je-xs je-muted je-truncate">{{ todo.detail }}</span>
                </span>
                <ion-icon name="chevron-forward" class="todo__chev" />
              </a>
            }
          </div>
        }

        <!-- 3. Start planning: the categories are the way in ------------------ -->
        <div class="head head--row">
          <h2>Plan an event</h2>
          <a routerLink="/customer/tabs/events">See all</a>
        </div>
        <div class="cats">
          @for (category of categories(); track category.id) {
            <a class="cat" [routerLink]="['/customer/tabs/events']" [queryParams]="{ category: category.id }">
              <span class="cat__art" [style.background]="category.gradient || 'var(--je-gradient-primary)'">
                @if (category.icon) { <i class="bi {{ category.icon }}"></i> } @else { <ion-icon name="sparkles" /> }
              </span>
              <span class="cat__name je-truncate">{{ category.name }}</span>
              @if (category.startingPrice) {
                <span class="je-xs je-soft">from {{ category.startingPrice | inr: true }}</span>
              }
            </a>
          } @empty {
            @if (loading()) {
              @for (i of [1, 2, 3, 4]; track i) {
                <span class="cat"><ion-skeleton-text [animated]="true" class="cat__art" /></span>
              }
            }
          }
        </div>

        <!-- 4. Help, when they want it -------------------------------------- -->
        <a class="roshi" routerLink="/customer/roshi">
          <span class="roshi__icon"><ion-icon name="sparkles" /></span>
          <span class="roshi__text">
            <strong>Ask Roshi</strong>
            <span class="je-xs je-muted">Packages for your budget, bookings, refunds</span>
          </span>
          <ion-icon name="chevron-forward" class="todo__chev" />
        </a>
      </div>
    </ion-content>
  `,
  styles: [`
    .greet { display: flex; flex-direction: column; padding-left: 16px; line-height: 1.25; }
    .greet strong { font-family: var(--je-font-heading); font-size: var(--je-fs-lg); text-transform: capitalize; }
    .dot { position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 2px 5px; }
    .points { display: inline-flex; align-items: center; gap: 5px; margin-right: 4px; padding: 5px 10px;
              border-radius: var(--je-radius-full); background: rgba(245, 158, 11, 0.12); color: #b45309;
              font-size: var(--je-fs-xs); font-weight: 700; text-decoration: none; }

    .home { display: flex; flex-direction: column; gap: 14px; padding-bottom: 28px; }
    .head { font-size: var(--je-fs-md); font-weight: 700; margin: 10px 0 0; }
    .head--row { display: flex; align-items: baseline; justify-content: space-between; }
    .head--row h2 { font-size: var(--je-fs-md); font-weight: 700; margin: 0; }
    .head--row a { font-size: var(--je-fs-sm); font-weight: 600; color: var(--ion-color-primary); text-decoration: none; }

    .next { display: block; border-radius: var(--je-radius-lg); padding: 18px 20px; text-decoration: none;
            box-shadow: 0 12px 28px rgba(255, 107, 53, 0.25); }
    .next__top { display: flex; align-items: center; justify-content: space-between; }
    .next__label { font-size: var(--je-fs-xs); text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
    .next__days { font-size: var(--je-fs-xs); font-weight: 700; background: rgba(255,255,255,0.22);
                  padding: 3px 10px; border-radius: var(--je-radius-full); }
    .next h2 { font-size: var(--je-fs-xl); margin: 8px 0 4px; }
    .next__meta { margin: 0; font-size: var(--je-fs-sm); opacity: 0.92; }
    .next__step { display: flex; align-items: center; gap: 7px; margin: 14px 0 0; padding-top: 12px;
                  border-top: 1px solid rgba(255,255,255,0.25); font-size: var(--je-fs-sm); font-weight: 600; }

    .start { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 18px 18px 20px;
             border-radius: var(--je-radius-lg); background: var(--je-bg-card); border: 1px solid var(--je-border-color);
             box-shadow: var(--je-shadow-sm); text-decoration: none; }
    .start__text { display: flex; flex-direction: column; gap: 3px; }
    .start__text strong { font-size: var(--je-fs-md); color: var(--je-text-main); }
    .start__go { width: 44px; height: 44px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%;
                 background: var(--je-gradient-primary); color: #fff; font-size: 19px; }

    .list { display: flex; flex-direction: column; border-radius: var(--je-radius-lg); overflow: hidden;
            background: var(--je-bg-card); border: 1px solid var(--je-border-color); }
    .todo, .roshi { display: flex; align-items: center; gap: 12px; padding: 13px 14px; text-decoration: none; }
    .todo + .todo { border-top: 1px solid var(--je-border-color); }
    .todo__icon, .roshi__icon { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center;
                                border-radius: 12px; font-size: 18px; }
    .todo__icon--pay { background: rgba(255,107,53,0.12); color: #ea580c; }
    .todo__icon--wait { background: rgba(59,130,246,0.12); color: #2563eb; }
    .todo__icon--review { background: rgba(245,158,11,0.14); color: #d97706; }
    .todo__text, .roshi__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .todo__text strong, .roshi__text strong { font-size: var(--je-fs-sm); color: var(--je-text-main); }
    .todo__chev { color: var(--je-text-soft); font-size: 16px; flex-shrink: 0; }

    .cats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .cat { display: flex; flex-direction: column; align-items: center; gap: 5px; text-decoration: none; min-width: 0; }
    .cat__art { width: 58px; height: 58px; display: grid; place-items: center; border-radius: 18px; color: #fff; }
    .cat__art ion-icon, .cat__art i { font-size: 24px; }
    .cat__name { font-size: var(--je-fs-xs); font-weight: 600; color: var(--je-text-main); max-width: 100%; text-align: center; }

    .roshi { margin-top: 6px; border-radius: var(--je-radius-lg); background: var(--je-bg-card);
             border: 1px solid var(--je-border-color); }
    .roshi__icon { background: var(--je-gradient-primary); color: #fff; }
  `]
})
export class CustomerDashboardPage implements OnInit, ViewWillEnter {
  auth = inject(AuthService);
  notifications = inject(NotificationService);
  private dashboard = inject(DashboardService);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly profile = signal<CustomerProfile | null>(null);
  readonly bookings = signal<Booking[]>([]);
  readonly categories = signal<EventType[]>([]);

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
    this.dashboard.getCustomerDashboard().subscribe(data => {
      this.profile.set(data.profile);
      this.bookings.set(data.bookings);
      this.categories.set(data.categories.slice(0, 8));
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
