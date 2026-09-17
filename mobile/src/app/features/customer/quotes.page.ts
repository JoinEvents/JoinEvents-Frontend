import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
  IonFab, IonFabButton, IonRefresher, IonRefresherContent, IonBadge
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { RfpService } from '../../core/services/rfp.service';
import { EventRfp } from '../../core/models/rfp.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

/** Quote requests the customer has raised, and how many bids each has drawn. */
@Component({
  selector: 'app-customer-quotes',
  standalone: true,
  imports: [
    DatePipe, RouterLink, CurrencyInrPipe, ListSkeletonComponent, EmptyStateComponent, StatusPillComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
    IonFab, IonFabButton, IonRefresher, IonRefresherContent, IonBadge
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/dashboard" text="" />
        </ion-buttons>
        <ion-title>Quote requests</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="3" />
        } @else if (!quotes().length) {
          <app-empty-state
            icon="chatbubble-ellipses-outline"
            title="No quote requests yet"
            message="Describe your event once and let vendors send you offers."
            actionLabel="Create a request"
            (action)="create()" />
        } @else {
          @for (quote of quotes(); track quote.id) {
            <a class="je-card card" [routerLink]="['/customer/quotes', quote.id]">
              <div class="card__head">
                <strong class="je-truncate">{{ quote.title || quote.eventTypeName }}</strong>
                <app-status-pill [status]="quote.status" />
              </div>

              <div class="card__meta">
                <span class="je-sm je-muted">
                  <ion-icon name="calendar-outline" /> {{ quote.eventDate | date: 'd MMM y' }}
                </span>
                @if (quote.guestCount) {
                  <span class="je-sm je-muted"><ion-icon name="people-outline" /> {{ quote.guestCount }}</span>
                }
              </div>

              <div class="card__foot">
                <span class="je-sm je-muted">
                  Budget
                  <strong class="je-price">{{ quote.budgetMin | inr: true }}–{{ quote.budgetMax | inr: true }}</strong>
                </span>
                <span class="bids">
                  <ion-icon name="pricetags-outline" />
                  {{ bidCount(quote) }} {{ bidCount(quote) === 1 ? 'offer' : 'offers' }}
                  @if (bidCount(quote) > 0) { <ion-badge color="primary">New</ion-badge> }
                </span>
              </div>
            </a>
          }
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button class="fab" (click)="create()">
          <ion-icon name="add" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .card { display: block; text-decoration: none; }
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__head strong { font-size: var(--je-fs-base); color: var(--je-text-main); flex: 1; min-width: 0; }
    .card__meta { display: flex; gap: 16px; margin-top: 12px; }
    .card__meta span { display: inline-flex; align-items: center; gap: 5px; }
    .card__foot { display: flex; align-items: center; justify-content: space-between;
                  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .bids { display: inline-flex; align-items: center; gap: 6px;
            font-size: var(--je-fs-sm); color: var(--je-text-muted); }
    .fab { --background: var(--je-gradient-primary); --color: #fff; }
  `]
})
export class CustomerQuotesPage implements ViewWillEnter {
  private rfpService = inject(RfpService);
  private router = inject(Router);

  readonly loading = signal(true);
  readonly quotes = signal<EventRfp[]>([]);

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.rfpService.getMyRfps().subscribe(quotes => {
      this.quotes.set(quotes);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  bidCount(quote: EventRfp): number {
    return quote.bids?.length ?? 0;
  }

  create(): void {
    void this.router.navigate(['/customer/quotes/create']);
  }
}
