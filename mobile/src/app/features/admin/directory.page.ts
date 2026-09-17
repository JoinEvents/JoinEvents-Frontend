import { Component, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonSegment, IonSegmentButton,
  IonLabel, IonIcon, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { AdminService } from '../../core/services/admin.service';
import { PhoneMaskPipe } from '../../shared/pipes/phone-mask.pipe';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** Customer and vendor directories with server-side search. */
@Component({
  selector: 'app-admin-directory',
  standalone: true,
  imports: [
    PhoneMaskPipe, CurrencyInrPipe, StatusPillComponent, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonSegment, IonSegmentButton,
    IonLabel, IonIcon, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Directory</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab()" (ionChange)="switchTab($any($event.detail.value))">
          <ion-segment-button value="customers"><ion-label>Customers</ion-label></ion-segment-button>
          <ion-segment-button value="vendors"><ion-label>Vendors</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar [placeholder]="'Search ' + tab()" [debounce]="400"
                       (ionInput)="search($any($event.target).value ?? '')" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="6" />
        } @else if (!records().length) {
          <app-empty-state icon="people-outline" title="No matches"
                           message="Try a different name, email or phone number." />
        } @else {
          @for (record of records(); track $any(record['id'])) {
            <div class="je-card row">
              <div class="avatar">{{ initials($any(record['name'] ?? record['businessName'])) }}</div>

              <div class="row__body">
                <strong class="je-sm je-truncate">
                  {{ record['businessName'] || record['name'] }}
                </strong>
                <span class="je-xs je-muted je-truncate">{{ record['email'] }}</span>
                <span class="je-xs je-soft">{{ $any(record['phone']) | phoneMask }}</span>

                <div class="tags">
                  @if (record['city']) {
                    <span class="je-pill je-pill--neutral">{{ record['city'] }}</span>
                  }
                  @if (tab() === 'vendors' && record['verificationStatus']) {
                    <app-status-pill [status]="$any(record['verificationStatus'])" />
                  }
                  @if (tab() === 'customers' && record['accountStatus']) {
                    <app-status-pill [status]="$any(record['accountStatus'])" />
                  }
                </div>
              </div>

              <div class="row__end">
                @if (tab() === 'customers') {
                  <span class="je-price je-sm">{{ $any(record['totalSpent'] ?? 0) | inr: true }}</span>
                  <span class="je-xs je-soft">{{ record['totalBookings'] ?? 0 }} bookings</span>
                } @else {
                  <span class="rating">
                    <ion-icon name="star" /> {{ record['rating'] ?? '—' }}
                  </span>
                  <span class="je-xs je-soft">{{ record['totalReviews'] ?? 0 }} reviews</span>
                }
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .row { display: flex; gap: 12px; align-items: flex-start; }
    .avatar { width: 42px; height: 42px; flex-shrink: 0; display: grid; place-items: center;
              border-radius: 50%; background: var(--je-gradient-secondary); color: #fff;
              font-weight: 700; font-size: var(--je-fs-sm); }
    .row__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
    .row__end { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
    .rating { display: inline-flex; align-items: center; gap: 4px;
              font-size: var(--je-fs-sm); font-weight: 700; }
    .rating ion-icon { color: var(--je-accent); font-size: 13px; }
  `]
})
export class AdminDirectoryPage implements ViewWillEnter {
  private adminService = inject(AdminService);

  readonly loading = signal(true);
  readonly records = signal<Record<string, unknown>[]>([]);
  readonly tab = signal<'customers' | 'vendors'>('customers');

  private query = '';

  ionViewWillEnter(): void {
    this.load();
  }

  switchTab(tab: 'customers' | 'vendors'): void {
    this.tab.set(tab);
    this.load();
  }

  search(term: string): void {
    this.query = term;
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    const source$ = this.tab() === 'customers'
      ? this.adminService.getCustomers(this.query || undefined)
      : this.adminService.getVendors(this.query || undefined);

    source$.subscribe(records => {
      this.records.set(records);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  initials(name: string | undefined): string {
    return (name ?? '?').split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }
}
