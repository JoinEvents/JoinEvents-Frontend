import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonList, IonItem, IonLabel,
  IonBadge, IonButton, IonAvatar
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MessengerService } from '../../core/services/messenger.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileService } from '../../core/services/profile.service';

/** Everything that does not earn a tab: finance, verification, messages, settings. */
@Component({
  selector: 'app-vendor-more',
  standalone: true,
  imports: [
    RouterLink,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonList, IonItem, IonLabel,
    IonBadge, IonButton, IonAvatar
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>More</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <div class="je-card ident">
          @if (auth.currentUser()?.avatar) {
            <ion-avatar><img [src]="auth.currentUser()?.avatar" alt="" /></ion-avatar>
          } @else {
            <div class="initials">{{ initials() }}</div>
          }
          <div class="ident__body">
            <strong>{{ auth.currentUser()?.name }}</strong>
            <span class="je-xs je-muted je-truncate">{{ auth.currentUser()?.email }}</span>
            <span class="je-pill je-pill--neutral">Vendor account</span>
          </div>
        </div>

        <ion-list class="je-card je-card--flush menu" [inset]="false">
          <ion-item routerLink="/vendor/profile" [detail]="true" lines="full">
            <ion-icon name="storefront-outline" slot="start" color="medium" />
            <ion-label>Business profile</ion-label>
          </ion-item>

          <ion-item routerLink="/vendor/messages" [detail]="true" lines="full">
            <ion-icon name="chatbubbles-outline" slot="start" color="medium" />
            <ion-label>Messages</ion-label>
            @if (messenger.totalUnread() > 0) {
              <ion-badge color="danger" slot="end">{{ messenger.totalUnread() }}</ion-badge>
            }
          </ion-item>

          <ion-item routerLink="/vendor/notifications" [detail]="true" lines="full">
            <ion-icon name="notifications-outline" slot="start" color="medium" />
            <ion-label>Notifications</ion-label>
            @if (notifications.unreadCount() > 0) {
              <ion-badge color="danger" slot="end">{{ notifications.unreadCount() }}</ion-badge>
            }
          </ion-item>

          <ion-item routerLink="/vendor/calendar" [detail]="true" lines="full">
            <ion-icon name="calendar-outline" slot="start" color="medium" />
            <ion-label>Availability calendar</ion-label>
          </ion-item>

          <ion-item routerLink="/vendor/finance" [detail]="true" lines="full">
            <ion-icon name="wallet-outline" slot="start" color="medium" />
            <ion-label>Invoices &amp; payouts</ion-label>
          </ion-item>

          <ion-item routerLink="/vendor/verification" [detail]="true" lines="full">
            <ion-icon name="shield-checkmark-outline" slot="start" color="medium" />
            <ion-label>Verification</ion-label>
          </ion-item>

          <ion-item routerLink="/vendor/settings" [detail]="true" lines="none">
            <ion-icon name="settings-outline" slot="start" color="medium" />
            <ion-label>Settings</ion-label>
          </ion-item>
        </ion-list>

        <ion-button expand="block" fill="outline" color="danger" (click)="signOut()">
          <ion-icon slot="start" name="log-out-outline" /> Sign out
        </ion-button>

        <p class="je-xs je-soft version">JoinEvents for mobile · v1.0.0</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .ident { display: flex; align-items: center; gap: 16px; margin-top: 6px; }
    .ident ion-avatar { width: 60px; height: 60px; flex-shrink: 0; }
    .initials { width: 60px; height: 60px; flex-shrink: 0; display: grid; place-items: center;
                border-radius: 50%; background: var(--je-gradient-secondary); color: #fff;
                font-family: var(--je-font-heading); font-weight: 700; font-size: 20px; }
    .ident__body { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-width: 0; }
    .ident__body strong { font-family: var(--je-font-heading); font-size: var(--je-fs-md); }
    .menu { margin: 18px 0; }
    .menu ion-item { --background: var(--je-bg-card); --padding-start: 16px; }
    .version { text-align: center; padding: 20px 0; }
  `]
})
export class VendorMorePage {
  auth = inject(AuthService);
  notifications = inject(NotificationService);
  messenger = inject(MessengerService);
  private toast = inject(ToastService);
  private profileService = inject(ProfileService);

  ionViewWillEnter(): void {
    this.profileService.refreshCurrentUser();
  }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
  }

  async signOut(): Promise<void> {
    const confirmed = await this.toast.confirm('Sign out?', 'You will need to sign in again.', 'Sign out', true);
    if (confirmed) this.auth.logout();
  }
}
