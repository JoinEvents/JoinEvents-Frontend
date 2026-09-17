import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonButton, IonChip, IonLabel,
  IonModal, IonItem, IonInput, IonTextarea, IonSpinner, IonButtons, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { RfpService } from '../../core/services/rfp.service';
import { ToastService } from '../../core/services/toast.service';
import { EventRfp } from '../../core/models/rfp.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** Open quote requests a vendor can bid on — the lead pipeline. */
@Component({
  selector: 'app-vendor-quote-board',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, CurrencyInrPipe, TimeAgoPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonButton, IonChip, IonLabel,
    IonModal, IonItem, IonInput, IonTextarea, IonSpinner, IonButtons, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Quote board</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="4" />
        } @else if (!quotes().length) {
          <app-empty-state
            icon="megaphone-outline"
            title="No open requests"
            message="When customers post requests matching your categories, they appear here." />
        } @else {
          @for (quote of quotes(); track quote.id) {
            <div class="je-card card">
              <div class="card__head">
                <div class="card__title">
                  <strong class="je-clamp-2">{{ quote.title }}</strong>
                  <span class="je-xs je-soft">{{ quote.eventTypeName }} · posted {{ quote.createdAt | timeAgo }}</span>
                </div>
                <span class="budget je-price">{{ quote.budgetMax | inr: true }}</span>
              </div>

              <div class="grid">
                <span class="je-sm je-muted"><ion-icon name="calendar-outline" /> {{ quote.eventDate | date: 'd MMM y' }}</span>
                <span class="je-sm je-muted"><ion-icon name="people-outline" /> {{ quote.guestCount }} guests</span>
                <span class="je-sm je-muted je-truncate"><ion-icon name="location-outline" /> {{ quote.city }}</span>
                <span class="je-sm je-muted"><ion-icon name="pricetags-outline" /> {{ quote.bids.length }} bids</span>
              </div>

              @if (quote.servicesNeeded.length) {
                <div class="chips">
                  @for (service of quote.servicesNeeded.slice(0, 4); track service) {
                    <ion-chip><ion-label>{{ service }}</ion-label></ion-chip>
                  }
                  @if (quote.servicesNeeded.length > 4) {
                    <ion-chip><ion-label>+{{ quote.servicesNeeded.length - 4 }}</ion-label></ion-chip>
                  }
                </div>
              }

              @if (quote.requirements) {
                <p class="je-xs je-muted je-clamp-2 req">{{ quote.requirements }}</p>
              }

              <div class="card__foot">
                <span class="je-xs je-soft">
                  Budget {{ quote.budgetMin | inr: true }} – {{ quote.budgetMax | inr: true }}
                </span>
                <ion-button size="small" class="je-btn-gradient" (click)="openBid(quote)">
                  Submit a bid
                </ion-button>
              </div>
            </div>
          }
        }
      </div>
    </ion-content>

    <!-- Bid sheet ------------------------------------------------------- -->
    <ion-modal [isOpen]="bidOpen()" (didDismiss)="bidOpen.set(false)"
               [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85]">
      <ng-template>
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>Your bid</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="bidOpen.set(false)">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          @if (target(); as quote) {
            <p class="je-sm je-muted target">
              <strong>{{ quote.title }}</strong><br />
              Customer's budget: {{ quote.budgetMin | inr }} – {{ quote.budgetMax | inr }}
            </p>
          }

          <form [formGroup]="form">
            <ion-item class="je-field" lines="none">
              <ion-icon name="cash-outline" slot="start" color="medium" />
              <ion-input formControlName="proposedAmount" type="number" inputmode="numeric"
                         placeholder="Your price (₹)" />
            </ion-item>

            <ion-item class="je-field" lines="none">
              <ion-textarea formControlName="description" [rows]="4" [autoGrow]="true"
                            placeholder="Why should they pick you? Mention experience and what's included." />
            </ion-item>

            <ion-item class="je-field" lines="none">
              <ion-input [value]="deliverableDraft()" placeholder="Add a deliverable and press enter"
                         (ionInput)="deliverableDraft.set($any($event.target).value)"
                         (keyup.enter)="addDeliverable()" />
              <ion-button slot="end" fill="clear" (click)="addDeliverable()">
                <ion-icon slot="icon-only" name="add" />
              </ion-button>
            </ion-item>

            @if (deliverables().length) {
              <div class="chips">
                @for (item of deliverables(); track item) {
                  <ion-chip (click)="removeDeliverable(item)">
                    <ion-label>{{ item }}</ion-label>
                    <ion-icon name="close-circle" />
                  </ion-chip>
                }
              </div>
            }

            <ion-button expand="block" class="je-btn-gradient" (click)="submitBid()" [disabled]="saving()">
              @if (saving()) { <ion-spinner name="crescent" /> } @else { Send bid }
            </ion-button>
          </form>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__title { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
    .card__title strong { font-size: var(--je-fs-base); }
    .budget { flex-shrink: 0; font-size: var(--je-fs-md); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 12px; }
    .grid span { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    ion-chip { --background: var(--je-bg-light); --color: var(--je-text-muted); margin: 0;
               height: 24px; font-size: var(--je-fs-xs); font-weight: 600; }
    .req { margin: 12px 0 0; line-height: 1.55; }
    .card__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px;
                  margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .target { margin: 0 0 18px; line-height: 1.6; }
  `]
})
export class VendorQuoteBoardPage implements ViewWillEnter {
  private fb = inject(FormBuilder);
  private rfpService = inject(RfpService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly quotes = signal<EventRfp[]>([]);
  readonly bidOpen = signal(false);
  readonly target = signal<EventRfp | null>(null);
  readonly deliverables = signal<string[]>([]);
  readonly deliverableDraft = signal('');

  readonly form = this.fb.nonNullable.group({
    proposedAmount: [0, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.required, Validators.minLength(20)]]
  });

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.rfpService.getOpenRfps().subscribe(quotes => {
      this.quotes.set(quotes);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  openBid(quote: EventRfp): void {
    this.target.set(quote);
    this.deliverables.set([]);
    this.form.reset({ proposedAmount: quote.budgetMax, description: '' });
    this.bidOpen.set(true);
  }

  addDeliverable(): void {
    const value = this.deliverableDraft().trim();
    if (!value || this.deliverables().includes(value)) return;
    this.deliverables.update(list => [...list, value]);
    this.deliverableDraft.set('');
  }

  removeDeliverable(item: string): void {
    this.deliverables.update(list => list.filter(i => i !== item));
  }

  submitBid(): void {
    const quote = this.target();
    if (!quote) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.toast.error('Add your price and explain what you are offering.');
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();

    this.rfpService
      .submitBid(quote.id, {
        proposedAmount: value.proposedAmount,
        description: value.description,
        deliverables: this.deliverables()
      })
      .subscribe(bid => {
        this.saving.set(false);
        if (!bid) {
          void this.toast.error('Your bid was not sent. Please try again.');
          return;
        }
        this.bidOpen.set(false);
        void this.toast.success('Bid sent — the customer will be notified.');
        this.load();
      });
  }
}
