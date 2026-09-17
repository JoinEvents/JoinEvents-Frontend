import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonProgressBar, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { LoyaltyService, LoyaltyBalance } from '../../core/services/loyalty.service';
import { AuthService } from '../../core/services/auth.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { LoyaltyTransaction } from '../../core/models/user.model';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** Loyalty points, tier progress and the referral invite. */
@Component({
  selector: 'app-customer-rewards',
  standalone: true,
  imports: [
    DatePipe, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonProgressBar, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/profile" text="" />
        </ion-buttons>
        <ion-title>Rewards</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        <!-- Balance ------------------------------------------------------ -->
        <div class="balance je-gradient">
          <span class="balance__label">Your points</span>
          <strong class="balance__value">{{ balance()?.points ?? 0 }}</strong>
          <span class="balance__worth">worth ₹{{ balance()?.points ?? 0 }} off your next booking</span>

          @if (balance(); as b) {
            @if (b.nextTier) {
              <div class="tier">
                <div class="tier__row">
                  <span>{{ b.tier }}</span>
                  <span>{{ b.nextTier }}</span>
                </div>
                <ion-progress-bar [value]="tierProgress(b)" />
                <span class="tier__hint">{{ b.pointsToNextTier }} points to {{ b.nextTier }}</span>
              </div>
            }
          }
        </div>

        <!-- Earn ---------------------------------------------------------- -->
        <div class="je-section-head"><h2>Ways to earn</h2></div>
        <div class="je-card">
          @for (way of earnWays; track way.label) {
            <div class="way">
              <span class="way__icon"><ion-icon [name]="way.icon" /></span>
              <div class="way__body">
                <strong class="je-sm">{{ way.label }}</strong>
                <span class="je-xs je-muted">{{ way.detail }}</span>
              </div>
              <span class="way__points">+{{ way.points }}</span>
            </div>
          }
        </div>

        <!-- Referral -------------------------------------------------------- -->
        @if (balance()?.referralCode; as code) {
          <div class="je-section-head"><h2>Invite friends</h2></div>
          <div class="je-card referral">
            <p class="je-sm je-muted">
              Share your code. When a friend completes their first booking, you both get 500 points.
            </p>
            <div class="code">
              <span>{{ code }}</span>
              <ion-button size="small" fill="clear" (click)="copyCode(code)">
                <ion-icon slot="icon-only" name="copy-outline" />
              </ion-button>
            </div>
            <ion-button expand="block" class="je-btn-gradient" (click)="invite(code)">
              <ion-icon slot="start" name="share-social-outline" /> Share invite
            </ion-button>
          </div>
        }

        <!-- History ---------------------------------------------------------- -->
        <div class="je-section-head"><h2>History</h2></div>
        @if (!history().length) {
          <app-empty-state
            icon="time-outline"
            title="No points activity"
            message="Points you earn and redeem will show up here." />
        } @else {
          @for (entry of history(); track entry.id) {
            <div class="je-card row">
              <div class="row__body">
                <strong class="je-sm je-truncate">{{ entry.description }}</strong>
                <span class="je-xs je-muted">{{ entry.date | date: 'd MMM y' }}</span>
              </div>
              <strong class="pts" [class.pts--minus]="entry.type === 'redeemed'">
                {{ entry.type === 'redeemed' ? '−' : '+' }}{{ entry.points }}
              </strong>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .balance { border-radius: var(--je-radius-lg); padding: 24px 20px; text-align: center;
               margin-top: 6px; box-shadow: 0 12px 28px rgba(255, 107, 53, 0.28); }
    .balance__label { font-size: var(--je-fs-xs); text-transform: uppercase;
                      letter-spacing: 0.08em; opacity: 0.85; }
    .balance__value { display: block; font-family: var(--je-font-heading);
                      font-size: 40px; font-weight: 700; line-height: 1.15; margin: 4px 0; }
    .balance__worth { font-size: var(--je-fs-sm); opacity: 0.92; }
    .tier { margin-top: 20px; }
    .tier__row { display: flex; justify-content: space-between; font-size: var(--je-fs-xs);
                 font-weight: 700; margin-bottom: 6px; }
    .tier ion-progress-bar { --background: rgba(255,255,255,0.3); --progress-background: #fff;
                             height: 6px; border-radius: 3px; }
    .tier__hint { display: block; margin-top: 7px; font-size: var(--je-fs-xs); opacity: 0.88; }

    .way { display: flex; align-items: center; gap: 12px; padding: 9px 0;
           border-bottom: 1px solid var(--je-border-color); }
    .way:last-child { border-bottom: none; }
    .way__icon { width: 34px; height: 34px; flex-shrink: 0; display: grid; place-items: center;
                 border-radius: 50%; background: rgba(255,107,53,0.1); color: var(--je-primary); }
    .way__icon ion-icon { font-size: 16px; }
    .way__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .way__points { font-weight: 700; font-size: var(--je-fs-sm); color: var(--je-success); flex-shrink: 0; }

    .referral p { margin: 0 0 14px; line-height: 1.55; }
    .code { display: flex; align-items: center; justify-content: space-between; gap: 10px;
            padding: 10px 14px; margin-bottom: 14px; border-radius: var(--je-radius-sm);
            background: var(--je-bg-light); border: 1px dashed var(--je-border-color); }
    .code span { font-family: var(--je-font-heading); font-weight: 700;
                 letter-spacing: 0.12em; font-size: var(--je-fs-md); }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .row__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
    .pts { flex-shrink: 0; font-size: var(--je-fs-base); color: var(--je-success); }
    .pts--minus { color: var(--je-danger); }
  `]
})
export class CustomerRewardsPage implements ViewWillEnter {
  private loyalty = inject(LoyaltyService);
  private auth = inject(AuthService);
  private shareService = inject(ShareService);
  private toast = inject(ToastService);

  readonly balance = signal<LoyaltyBalance | null>(null);
  readonly history = signal<LoyaltyTransaction[]>([]);

  readonly earnWays = [
    { icon: 'calendar', label: 'Complete a booking', detail: '1 point per ₹100 spent', points: '1%' },
    { icon: 'star', label: 'Leave a review', detail: 'After each completed event', points: '100' },
    { icon: 'people', label: 'Refer a friend', detail: "When they complete their first booking", points: '500' }
  ];

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;

    this.loyalty.getBalance(userId).subscribe(balance => {
      this.balance.set(balance);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
    this.loyalty.getHistory(userId).subscribe(history => this.history.set(history));
  }

  tierProgress(balance: LoyaltyBalance): number {
    const remaining = balance.pointsToNextTier;
    if (remaining <= 0) return 1;
    // Progress within the current tier band: how far past its floor the user is.
    const bandSize = balance.points + remaining;
    return bandSize > 0 ? balance.points / bandSize : 0;
  }

  async copyCode(code: string): Promise<void> {
    await navigator.clipboard?.writeText(code).catch(() => void 0);
    void this.toast.success('Referral code copied.');
  }

  async invite(code: string): Promise<void> {
    await this.shareService.shareReferral(code);
  }
}
