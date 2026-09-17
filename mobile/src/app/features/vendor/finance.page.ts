import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Browser } from '@capacitor/browser';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonButton,
  IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { VendorService } from '../../core/services/vendor.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

interface Invoice {
  id: string;
  invoiceNumber?: string;
  bookingNumber?: string;
  amount: number;
  platformFee?: number;
  tds?: number;
  payoutAmount?: number;
  status: string;
  issuedAt: string;
  downloadUrl?: string;
}

/** Invoices and payouts, with the platform fee and TDS shown per invoice. */
@Component({
  selector: 'app-vendor-finance',
  standalone: true,
  imports: [
    DatePipe, CurrencyInrPipe, StatusPillComponent, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonButton,
    IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonLabel
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/vendor/tabs/more" text="" />
        </ion-buttons>
        <ion-title>Invoices &amp; payouts</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event.detail.value))">
          <ion-segment-button value="all"><ion-label>All</ion-label></ion-segment-button>
          <ion-segment-button value="pending"><ion-label>Pending</ion-label></ion-segment-button>
          <ion-segment-button value="paid"><ion-label>Paid</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (!loading() && invoices().length) {
          <div class="je-grid-2 summary">
            <div class="je-stat">
              <div class="je-stat__value">{{ totalEarned() | inr: true }}</div>
              <div class="je-stat__label">Paid out</div>
            </div>
            <div class="je-stat">
              <div class="je-stat__value">{{ totalPending() | inr: true }}</div>
              <div class="je-stat__label">Awaiting payout</div>
            </div>
          </div>
        }

        @if (loading()) {
          <app-list-skeleton [count]="4" />
        } @else if (!visible().length) {
          <app-empty-state
            icon="wallet-outline"
            title="No invoices"
            message="Invoices are generated automatically once a booking completes." />
        } @else {
          @for (invoice of visible(); track invoice.id) {
            <div class="je-card card">
              <div class="card__head">
                <div class="card__title">
                  <strong class="je-sm">{{ invoice.invoiceNumber || 'Invoice ' + invoice.id.slice(0, 8) }}</strong>
                  @if (invoice.bookingNumber) {
                    <span class="je-xs je-soft">Booking {{ invoice.bookingNumber }}</span>
                  }
                </div>
                <app-status-pill [status]="invoice.status" />
              </div>

              <div class="lines">
                <div class="line">
                  <span class="je-sm je-muted">Booking value</span>
                  <span class="je-sm">{{ invoice.amount | inr }}</span>
                </div>
                @if (invoice.platformFee) {
                  <div class="line">
                    <span class="je-sm je-muted">Platform fee</span>
                    <span class="je-sm deduct">−{{ invoice.platformFee | inr }}</span>
                  </div>
                }
                @if (invoice.tds) {
                  <div class="line">
                    <span class="je-sm je-muted">TDS</span>
                    <span class="je-sm deduct">−{{ invoice.tds | inr }}</span>
                  </div>
                }
                <div class="line line--total">
                  <strong class="je-sm">Your payout</strong>
                  <strong class="je-price">{{ payout(invoice) | inr }}</strong>
                </div>
              </div>

              <div class="card__foot">
                <span class="je-xs je-soft">{{ invoice.issuedAt | date: 'd MMM y' }}</span>
                @if (invoice.downloadUrl) {
                  <ion-button size="small" fill="clear" (click)="download(invoice.downloadUrl!)">
                    <ion-icon slot="start" name="download-outline" /> PDF
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
    .summary { margin-top: 6px; margin-bottom: 4px; }
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__title { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
    .lines { margin-top: 12px; }
    .line { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; }
    .line--total { margin-top: 5px; padding-top: 10px; border-top: 1px solid var(--je-border-color); }
    .deduct { color: var(--je-danger); }
    .card__foot { display: flex; align-items: center; justify-content: space-between;
                  margin-top: 10px; padding-top: 8px; }
  `]
})
export class VendorFinancePage implements ViewWillEnter {
  private vendorService = inject(VendorService);

  readonly loading = signal(true);
  readonly invoices = signal<Invoice[]>([]);
  readonly filter = signal<'all' | 'pending' | 'paid'>('all');

  readonly visible = computed(() => {
    const all = this.invoices();
    if (this.filter() === 'all') return all;
    if (this.filter() === 'paid') return all.filter(i => this.isPaid(i));
    return all.filter(i => !this.isPaid(i));
  });

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.vendorService.getInvoices().subscribe(records => {
      this.invoices.set(records.map(r => this.toInvoice(r)));
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  /** Falls back to the booking value less deductions when the API omits the payout. */
  payout(invoice: Invoice): number {
    return invoice.payoutAmount ?? invoice.amount - (invoice.platformFee ?? 0) - (invoice.tds ?? 0);
  }

  totalEarned(): number {
    return this.invoices().filter(i => this.isPaid(i)).reduce((sum, i) => sum + this.payout(i), 0);
  }

  totalPending(): number {
    return this.invoices().filter(i => !this.isPaid(i)).reduce((sum, i) => sum + this.payout(i), 0);
  }

  async download(url: string): Promise<void> {
    await Browser.open({ url }).catch(() => void 0);
  }

  private isPaid(invoice: Invoice): boolean {
    return ['paid', 'settled', 'completed'].includes(invoice.status.toLowerCase());
  }

  private toInvoice(record: Record<string, unknown>): Invoice {
    return {
      id: String(record['id'] ?? ''),
      invoiceNumber: record['invoiceNumber'] as string | undefined,
      bookingNumber: record['bookingNumber'] as string | undefined,
      amount: Number(record['amount'] ?? record['bookingAmount'] ?? 0),
      platformFee: record['platformFeeAmount'] as number | undefined,
      tds: record['tdsDeducted'] as number | undefined,
      payoutAmount: record['vendorPayoutAmount'] as number | undefined,
      status: String(record['status'] ?? 'pending'),
      issuedAt: String(record['issuedAt'] ?? record['createdAt'] ?? new Date().toISOString()),
      downloadUrl: record['downloadUrl'] as string | undefined
    };
  }
}
