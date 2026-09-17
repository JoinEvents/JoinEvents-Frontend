import { Component, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CameraSource } from '@capacitor/camera';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonItem, IonLabel, IonList,
  IonAvatar, IonBadge, IonButton, ActionSheetController
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ToastService } from '../../core/services/toast.service';
import { CustomerProfile } from '../../core/models/user.model';

interface MenuLink {
  label: string;
  icon: string;
  route: string;
  badge?: () => number;
}

/** Account hub: identity, loyalty tier, and links to everything not in a tab. */
@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [
    RouterLink, LowerCasePipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonItem, IonLabel, IonList,
    IonAvatar, IonBadge, IonButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <!-- Identity ---------------------------------------------------- -->
        <div class="je-card ident">
          <button class="ident__avatar" (click)="changeAvatar()" aria-label="Change profile photo">
            @if (auth.currentUser()?.avatar) {
              <ion-avatar><img [src]="auth.currentUser()?.avatar" alt="" /></ion-avatar>
            } @else {
              <span class="initials">{{ initials() }}</span>
            }
            <span class="ident__camera"><ion-icon name="camera" /></span>
          </button>

          <div class="ident__body">
            <strong>{{ auth.currentUser()?.name }}</strong>
            <span class="je-xs je-muted je-truncate">{{ auth.currentUser()?.email }}</span>
            @if (profile()?.loyaltyTier) {
              <span class="tier" [class]="'tier--' + (profile()?.loyaltyTier | lowercase)">
                <ion-icon name="trophy" /> {{ profile()?.loyaltyTier }} member
              </span>
            }
          </div>
        </div>

        <!-- Loyalty summary --------------------------------------------- -->
        @if (profile(); as p) {
          <div class="je-grid-3 stats">
            <div class="je-stat">
              <div class="je-stat__value">{{ p.totalBookings }}</div>
              <div class="je-stat__label">Bookings</div>
            </div>
            <div class="je-stat">
              <div class="je-stat__value">{{ p.loyaltyPoints }}</div>
              <div class="je-stat__label">Points</div>
            </div>
            <div class="je-stat">
              <div class="je-stat__value">{{ favorites.count() }}</div>
              <div class="je-stat__label">Saved</div>
            </div>
          </div>
        }

        <!-- Menu ---------------------------------------------------------- -->
        <ion-list class="je-card je-card--flush menu" [inset]="false">
          @for (link of links; track link.route) {
            <ion-item [routerLink]="link.route" [detail]="true" lines="full">
              <ion-icon [name]="link.icon" slot="start" color="medium" />
              <ion-label>{{ link.label }}</ion-label>
              @if (link.badge && link.badge() > 0) {
                <ion-badge color="danger" slot="end">{{ link.badge!() }}</ion-badge>
              }
            </ion-item>
          }
        </ion-list>

        <ion-button expand="block" fill="outline" color="danger" class="signout" (click)="signOut()">
          <ion-icon slot="start" name="log-out-outline" /> Sign out
        </ion-button>

        <p class="je-xs je-soft version">JoinEvents for mobile · v1.0.0</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .ident { display: flex; align-items: center; gap: 16px; margin-top: 6px; }
    .ident__avatar { position: relative; width: 66px; height: 66px; flex-shrink: 0;
                     border: none; padding: 0; border-radius: 50%; background: var(--je-gradient-primary); }
    .ident__avatar ion-avatar { width: 66px; height: 66px; }
    .initials { display: grid; place-items: center; width: 100%; height: 100%;
                color: #fff; font-family: var(--je-font-heading); font-weight: 700; font-size: 22px; }
    .ident__camera { position: absolute; bottom: -2px; right: -2px; width: 24px; height: 24px;
                     display: grid; place-items: center; border-radius: 50%;
                     background: var(--je-bg-card); border: 1px solid var(--je-border-color); }
    .ident__camera ion-icon { font-size: 12px; color: var(--je-text-muted); }
    .ident__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .ident__body strong { font-family: var(--je-font-heading); font-size: var(--je-fs-md); }

    .tier { display: inline-flex; align-items: center; gap: 5px; margin-top: 4px; width: fit-content;
            padding: 3px 9px; border-radius: var(--je-radius-full);
            font-size: var(--je-fs-xs); font-weight: 700; }
    .tier ion-icon { font-size: 12px; }
    .tier--bronze { background: rgba(180, 120, 60, 0.14); color: #B4783C; }
    .tier--silver { background: rgba(148, 163, 184, 0.18); color: #64748B; }
    .tier--gold   { background: rgba(245, 158, 11, 0.16); color: #D97706; }

    .stats { margin: 16px 0 20px; }
    .menu { margin-bottom: 20px; }
    .menu ion-item { --background: var(--je-bg-card); --padding-start: 16px; }
    .signout { margin-bottom: 16px; }
    .version { text-align: center; padding-bottom: 24px; }
  `]
})
export class CustomerProfilePage implements ViewWillEnter {
  auth = inject(AuthService);
  favorites = inject(FavoritesService);
  private profileService = inject(ProfileService);
  private notifications = inject(NotificationService);
  private toast = inject(ToastService);
  private actionSheet = inject(ActionSheetController);

  readonly profile = signal<CustomerProfile | null>(null);

  readonly links: MenuLink[] = [
    { label: 'Notifications', icon: 'notifications-outline', route: '/customer/notifications', badge: () => this.notifications.unreadCount() },
    { label: 'Quote requests', icon: 'chatbubble-ellipses-outline', route: '/customer/quotes' },
    { label: 'Payments & invoices', icon: 'card-outline', route: '/customer/payments' },
    { label: 'Rewards & referrals', icon: 'gift-outline', route: '/customer/rewards' },
    { label: 'Saved packages', icon: 'heart-outline', route: '/customer/favorites' },
    { label: 'Help & support', icon: 'help-buoy-outline', route: '/customer/support' },
    { label: 'Settings', icon: 'settings-outline', route: '/customer/settings' }
  ];

  ionViewWillEnter(): void {
    this.profileService.getProfile().subscribe(profile => this.profile.set(profile));
  }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
  }

  /** Offers camera or gallery, matching the platform's own photo-picker pattern. */
  async changeAvatar(): Promise<void> {
    const sheet = await this.actionSheet.create({
      header: 'Profile photo',
      buttons: [
        { text: 'Take a photo', icon: 'camera', handler: () => this.upload(CameraSource.Camera) },
        { text: 'Choose from gallery', icon: 'images', handler: () => this.upload(CameraSource.Photos) },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  private upload(source: CameraSource): void {
    this.profileService.changeAvatar(source).subscribe(url => {
      if (!url) return;
      void this.toast.success('Profile photo updated.');
    });
  }

  async signOut(): Promise<void> {
    const confirmed = await this.toast.confirm('Sign out?', 'You will need to sign in again.', 'Sign out', true);
    if (confirmed) this.auth.logout();
  }
}
