import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonList, IonItem, IonLabel,
  IonBadge, IonButton
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-more',
  standalone: true,
  imports: [
    RouterLink,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonList, IonItem, IonLabel,
    IonBadge, IonButton
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
          <div class="initials">{{ initials() }}</div>
          <div class="ident__body">
            <strong>{{ auth.currentUser()?.name }}</strong>
            <span class="je-xs je-muted je-truncate">{{ auth.currentUser()?.email }}</span>
            <span class="je-pill je-pill--neutral">Administrator</span>
          </div>
        </div>

        <ion-list class="je-card je-card--flush menu" [inset]="false">
          <ion-item routerLink="/admin/verifications" [detail]="true" lines="full">
            <ion-icon name="shield-checkmark-outline" slot="start" color="medium" />
            <ion-label>Vendor verifications</ion-label>
          </ion-item>
          <ion-item routerLink="/admin/disputes" [detail]="true" lines="full">
            <ion-icon name="alert-circle-outline" slot="start" color="medium" />
            <ion-label>Disputes &amp; reviews</ion-label>
          </ion-item>
          <ion-item routerLink="/admin/audit" [detail]="true" lines="full">
            <ion-icon name="receipt-outline" slot="start" color="medium" />
            <ion-label>Audit trail</ion-label>
          </ion-item>
          <ion-item routerLink="/admin/notifications" [detail]="true" lines="full">
            <ion-icon name="notifications-outline" slot="start" color="medium" />
            <ion-label>Notifications</ion-label>
            @if (notifications.unreadCount() > 0) {
              <ion-badge color="danger" slot="end">{{ notifications.unreadCount() }}</ion-badge>
            }
          </ion-item>
          <ion-item routerLink="/admin/settings" [detail]="true" lines="none">
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
    .initials { width: 60px; height: 60px; flex-shrink: 0; display: grid; place-items: center;
                border-radius: 50%; background: var(--je-gradient-dark); color: #fff;
                font-family: var(--je-font-heading); font-weight: 700; font-size: 20px; }
    .ident__body { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-width: 0; }
    .ident__body strong { font-family: var(--je-font-heading); font-size: var(--je-fs-md); }
    .menu { margin: 18px 0; }
    .menu ion-item { --background: var(--je-bg-card); --padding-start: 16px; }
    .version { text-align: center; padding: 20px 0; }
  `]
})
export class AdminMorePage {
  auth = inject(AuthService);
  notifications = inject(NotificationService);
  private toast = inject(ToastService);

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
  }

  async signOut(): Promise<void> {
    const confirmed = await this.toast.confirm('Sign out?', 'You will need to sign in again.', 'Sign out', true);
    if (confirmed) this.auth.logout();
  }
}
