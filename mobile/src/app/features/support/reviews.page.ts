import { Component, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonButton,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { SupportService } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * Flagged review moderation. Each card shows the review and why it was
 * flagged, because those two together are the whole decision.
 */
@Component({
  selector: 'app-review-moderation',
  standalone: true,
  imports: [
    TimeAgoPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonButton,
    IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/support/tabs/dashboard" text="" />
        </ion-buttons>
        <ion-title>Flagged reviews</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="4" />
        } @else if (!reviews().length) {
          <app-empty-state icon="chatbox-ellipses-outline" title="Nothing flagged"
                           message="No reviews are waiting for moderation." />
        } @else {
          @for (review of reviews(); track $any(review['id'])) {
            <div class="je-card card">
              <div class="card__head">
                <div class="card__title">
                  <strong class="je-sm je-truncate">{{ review['customerName'] || 'Customer' }}</strong>
                  <span class="je-xs je-soft">
                    on {{ review['vendorName'] || 'a vendor' }} ·
                    {{ $any(review['createdAt']) | timeAgo }}
                  </span>
                </div>
                <div class="stars">
                  @for (star of [1,2,3,4,5]; track star) {
                    <ion-icon [name]="star <= $any(review['rating'] ?? 0) ? 'star' : 'star-outline'" />
                  }
                </div>
              </div>

              <p class="je-sm body">{{ review['comment'] }}</p>

              @if (review['flagReason']) {
                <p class="flag je-xs">
                  <ion-icon name="flag" /> Flagged: {{ review['flagReason'] }}
                  @if (review['flaggedBy']) { <span class="je-soft"> by {{ review['flaggedBy'] }}</span> }
                </p>
              }

              <div class="acts">
                <ion-button size="small" fill="outline" color="danger" (click)="moderate(review, 'remove')">
                  <ion-icon slot="start" name="trash-outline" /> Remove
                </ion-button>
                <ion-button size="small" fill="outline" (click)="moderate(review, 'keep')">
                  <ion-icon slot="start" name="checkmark-outline" /> Keep
                </ion-button>
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__title { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
    .stars { display: flex; gap: 2px; flex-shrink: 0; }
    .stars ion-icon { font-size: 13px; color: var(--je-accent); }
    .body { margin: 12px 0 0; line-height: 1.6; color: var(--je-text-muted);
            padding: 11px 13px; border-radius: var(--je-radius-sm); background: var(--je-bg-light); }
    .flag { display: flex; align-items: center; gap: 6px; margin: 12px 0 0;
            color: var(--je-danger); font-weight: 600; }
    .acts { display: flex; gap: 8px; justify-content: flex-end;
            margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
  `]
})
export class ReviewModerationPage implements ViewWillEnter {
  private supportService = inject(SupportService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly reviews = signal<Record<string, unknown>[]>([]);

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.supportService.getFlaggedReviews().subscribe(reviews => {
      this.reviews.set(reviews);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  async moderate(review: Record<string, unknown>, action: 'keep' | 'remove'): Promise<void> {
    if (action === 'remove') {
      const confirmed = await this.toast.confirm(
        'Remove this review?',
        "It is taken down and no longer counts towards the vendor's rating.",
        'Remove',
        true
      );
      if (!confirmed) return;
    }

    this.supportService.moderateReview(String(review['id']), action).subscribe(success => {
      if (!success) {
        void this.toast.error('Could not moderate the review.');
        return;
      }
      void this.toast.success(action === 'keep' ? 'Review kept and unflagged.' : 'Review removed.');
      this.load();
    });
  }
}
