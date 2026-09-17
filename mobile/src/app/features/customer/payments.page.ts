import { Component, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
  IonRefresher, IonRefresherContent, IonButton
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { Browser } from '@capacitor/browser';

import { PaymentService, PaymentRecord } from '../../core/services/payment.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** Payment history with invoice downloads. */
@Component({
  selector: 'app-customer-payments',
  standalone: true,
  imports: [
    DatePipe, TitleCasePipe, CurrencyInrPipe, StatusPillComponent, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
    IonRefresher, IonRefresherContent, IonButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/profile" text="" />
        </ion-buttons>
        <ion-title>Payments</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (!loading() && payments().length) {
          <div class="je-card total">
            <span class="je-xs je-soft">Total paid on JoinEvents</span>
            <strong class="je-price big">{{ totalPaid() | inr }}</strong>
            <span class="je-xs je-muted">across {{ successful().length }} payments</span>
          </div>
        }

        @if (loading()) {
          <app-list-skeleton [count]="4" />
        } @else if (!payments().length) {
          <app-empty-state
            icon="card-outline"
            title="No payments yet"
            message="Your receipts and invoices will appear here once you book." />
        } @else {
          @for (payment of payments(); track payment.id) {
            <div class="je-card row">
              <div class="row__lead">
                <span class="icon" [class]="'icon--' + payment.status">
                  <ion-icon [name]="iconFor(payment.status)" />
                </span>
                <div class="row__body">
                  <strong class="je-sm je-truncate">
                    {{ payment.bookingNumber || 'Booking ' + payment.bookingId.slice(0, 8) }}
                  </strong>
                  <span class="je-xs je-muted">
                    {{ payment.paidAt | date: 'd MMM y, h:mm a' }} · {{ payment.method | titlecase }}
                  </span>
                </div>
              </div>

              <div class="row__end">
                <strong class="je-sm">{{ payment.amount | inr }}</strong>
                <app-status-pill [status]="payment.status" />
              </div>
            </div>

            @if (payment.invoiceUrl) {
              <ion-button size="small" fill="clear" class="inv" (click)="openInvoice(payment.invoiceUrl!)">
                <ion-icon slot="start" name="document-text-outline" /> View invoice
              </ion-button>
            }
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .total { text-align: center; padding: 20px; margin-top: 6px; }
    .total .big { display: block; font-size: var(--je-fs-2xl); margin: 6px 0 4px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .row__lead { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
    .icon { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; }
    .icon ion-icon { font-size: 17px; }
    .icon--success  { background: rgba(22, 163, 74, 0.12);  color: var(--je-success); }
    .icon--pending  { background: rgba(217, 119, 6, 0.12);  color: var(--je-warning); }
    .icon--failed   { background: rgba(220, 38, 38, 0.12);  color: var(--je-danger); }
    .icon--refunded { background: rgba(14, 165, 233, 0.12); color: var(--je-info); }
    .row__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .row__end { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
    .inv { margin: -8px 0 14px 4px; }
  `]
})
export class CustomerPaymentsPage implements ViewWillEnter {
  private paymentService = inject(PaymentService);

  readonly loading = signal(true);
  readonly payments = signal<PaymentRecord[]>([]);

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.paymentService.getHistory().subscribe(records => {
      this.payments.set(
        [...records].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      );
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  successful(): PaymentRecord[] {
    return this.payments().filter(p => p.status === 'success');
  }

  totalPaid(): number {
    return this.successful().reduce((sum, p) => sum + p.amount, 0);
  }

  iconFor(status: PaymentRecord['status']): string {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'failed': return 'close-circle';
      case 'refunded': return 'return-down-back';
    }
  }

  /** Invoices are PDFs — the system viewer handles them better than a WebView. */
  async openInvoice(url: string): Promise<void> {
    await Browser.open({ url }).catch(() => void 0);
  }
}
