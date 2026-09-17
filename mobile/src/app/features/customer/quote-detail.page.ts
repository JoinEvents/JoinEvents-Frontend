import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonSpinner, IonChip, IonLabel
} from '@ionic/angular/standalone';

import { RfpService } from '../../core/services/rfp.service';
import { ToastService } from '../../core/services/toast.service';
import { EventRfp, RfpBid } from '../../core/models/rfp.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

/** A quote request with the vendor bids it has attracted, ranked cheapest first. */
@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, CurrencyInrPipe, TimeAgoPipe, StatusPillComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonSpinner, IonChip, IonLabel
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/quotes" text="" />
        </ion-buttons>
        <ion-title>Request</ion-title>
        <ion-buttons slot="end">
          @if (quote()?.status === 'open') {
            <ion-button (click)="edit()"><ion-icon slot="icon-only" name="create-outline" /></ion-button>
          }
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent" /></div>
      } @else if (quote(); as q) {
        <div class="je-section">
          <div class="je-card">
            <div class="head">
              <h1>{{ q.title }}</h1>
              <app-status-pill [status]="q.status" />
            </div>
            <p class="meta"><ion-icon name="sparkles-outline" /> {{ q.eventTypeName }}</p>
            <p class="meta"><ion-icon name="calendar-outline" /> {{ q.eventDate | date: 'EEEE, d MMMM y' }}</p>
            <p class="meta"><ion-icon name="location-outline" /> {{ q.venueName || 'Venue not booked' }}, {{ q.city }}</p>
            <p class="meta"><ion-icon name="people-outline" /> {{ q.guestCount }} guests</p>
            <p class="meta"><ion-icon name="wallet-outline" /> {{ q.budgetMin | inr }} – {{ q.budgetMax | inr }}</p>
          </div>

          @if (q.servicesNeeded.length) {
            <div class="je-section-head"><h2>Services needed</h2></div>
            <div class="services">
              @for (service of q.servicesNeeded; track service) {
                <ion-chip><ion-label>{{ service }}</ion-label></ion-chip>
              }
            </div>
          }

          @if (q.requirements) {
            <div class="je-section-head"><h2>Requirements</h2></div>
            <div class="je-card"><p class="je-sm je-muted body">{{ q.requirements }}</p></div>
          }

          <!-- Bids ------------------------------------------------------- -->
          <div class="je-section-head">
            <h2>Offers ({{ sortedBids().length }})</h2>
          </div>

          @if (!sortedBids().length) {
            <div class="je-card waiting">
              <ion-icon name="hourglass-outline" />
              <strong class="je-sm">Waiting for offers</strong>
              <p class="je-xs je-muted">
                Vendors normally respond within 24 hours. We'll notify you as offers arrive.
              </p>
            </div>
          } @else {
            @for (bid of sortedBids(); track bid.id) {
              <div class="je-card bid" [class.bid--accepted]="bid.status === 'accepted'">
                <div class="bid__head">
                  <div class="bid__vendor">
                    <strong class="je-truncate">{{ bid.vendorBusinessName || bid.vendorName }}</strong>
                    <span class="bid__rating">
                      <ion-icon name="star" /> {{ bid.vendorRating | number: '1.1-1' }}
                      <span class="je-xs je-soft">({{ bid.vendorReviews }})</span>
                      @if (bid.isVerified) { <ion-icon name="shield-checkmark" color="success" /> }
                    </span>
                  </div>
                  <span class="bid__amount je-price">{{ bid.proposedAmount | inr }}</span>
                </div>

                @if (bid.description) {
                  <p class="je-sm je-muted body">{{ bid.description }}</p>
                }

                @if (bid.deliverables.length) {
                  <div class="deliverables">
                    @for (item of bid.deliverables; track item) {
                      <span class="je-xs"><ion-icon name="checkmark-circle" color="success" /> {{ item }}</span>
                    }
                  </div>
                }

                <div class="bid__foot">
                  <span class="je-xs je-soft">Offered {{ bid.submittedAt | timeAgo }}</span>
                  @if (bid.status === 'accepted') {
                    <span class="je-pill je-pill--confirmed">Accepted</span>
                  } @else if (q.status === 'open' || q.status === 'receiving_bids') {
                    <ion-button size="small" class="je-btn-gradient" (click)="accept(bid)">
                      Accept offer
                    </ion-button>
                  }
                </div>
              </div>
            }
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .head h1 { font-size: var(--je-fs-lg); margin: 0; flex: 1; }
    .meta { display: flex; align-items: center; gap: 7px; margin: 0 0 6px;
            font-size: var(--je-fs-sm); color: var(--je-text-muted); }
    .services { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    ion-chip { --background: var(--je-bg-light); --color: var(--je-text-muted); margin: 0;
               font-size: var(--je-fs-xs); font-weight: 600; }
    .body { margin: 0; line-height: 1.6; white-space: pre-wrap; }

    .waiting { text-align: center; padding: 26px 20px; }
    .waiting ion-icon { font-size: 30px; color: var(--je-text-soft); margin-bottom: 10px; }
    .waiting strong { display: block; margin-bottom: 5px; }
    .waiting p { margin: 0; line-height: 1.55; }

    .bid--accepted { border-color: var(--je-success); }
    .bid__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .bid__vendor { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
    .bid__vendor strong { font-size: var(--je-fs-base); }
    .bid__rating { display: inline-flex; align-items: center; gap: 4px; font-size: var(--je-fs-xs); font-weight: 600; }
    .bid__rating ion-icon { font-size: 12px; color: var(--je-accent); }
    .bid__amount { flex-shrink: 0; font-size: var(--je-fs-md); }
    .bid p.body { margin-top: 10px; }
    .deliverables { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; }
    .deliverables span { display: inline-flex; align-items: center; gap: 6px; color: var(--je-text-muted); }
    .bid__foot { display: flex; align-items: center; justify-content: space-between;
                 margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
  `]
})
export class QuoteDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private rfpService = inject(RfpService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly quote = signal<EventRfp | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.rfpService.getById(id).subscribe(quote => {
      this.quote.set(quote);
      this.loading.set(false);
    });
  }

  /** Accepted offer first, then cheapest — the two things people look for. */
  sortedBids(): RfpBid[] {
    const bids = this.quote()?.bids ?? [];
    return [...bids].sort((a, b) => {
      if (a.status === 'accepted') return -1;
      if (b.status === 'accepted') return 1;
      return a.proposedAmount - b.proposedAmount;
    });
  }

  edit(): void {
    const id = this.quote()?.id;
    if (id) void this.router.navigate(['/customer/quotes/edit', id]);
  }

  async accept(bid: RfpBid): Promise<void> {
    const quote = this.quote();
    if (!quote) return;

    const confirmed = await this.toast.confirm(
      'Accept this offer?',
      `This closes the request and starts a booking with ${bid.vendorBusinessName || bid.vendorName} at ₹${bid.proposedAmount.toLocaleString('en-IN')}.`,
      'Accept'
    );
    if (!confirmed) return;

    this.rfpService.acceptBid(quote.id, bid.id).subscribe(success => {
      if (!success) {
        void this.toast.error('We could not accept the offer. Please try again.');
        return;
      }
      void this.toast.success('Offer accepted — check My bookings for the next step.');
      this.load();
    });
  }
}
