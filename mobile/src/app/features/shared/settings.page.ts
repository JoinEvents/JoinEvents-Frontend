import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonToggle, IonSelect, IonSelectOption, IonModal, IonInput, IonSpinner
} from '@ionic/angular/standalone';

import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { StorageService } from '../../core/services/storage.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ToastService } from '../../core/services/toast.service';

/** Appearance, notification preferences, security and account removal. */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonToggle, IonSelect, IonSelectOption, IonModal, IonInput, IonSpinner
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/" text="" />
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <div class="je-section-head"><h2>Appearance</h2></div>
        <ion-list class="je-card je-card--flush" [inset]="false">
          <ion-item lines="none">
            <ion-icon name="contrast-outline" slot="start" color="medium" />
            <ion-label>Theme</ion-label>
            <ion-select slot="end" [value]="theme.mode()" interface="action-sheet"
                        (ionChange)="theme.setMode($any($event.detail.value))">
              <ion-select-option value="system">Match device</ion-select-option>
              <ion-select-option value="light">Light</ion-select-option>
              <ion-select-option value="dark">Dark</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-list>

        <div class="je-section-head"><h2>Notifications</h2></div>
        <ion-list class="je-card je-card--flush" [inset]="false">
          @for (pref of preferences; track pref.key) {
            <ion-item lines="full">
              <ion-icon [name]="pref.icon" slot="start" color="medium" />
              <ion-label>
                <strong class="je-sm">{{ pref.label }}</strong>
                <p class="je-xs je-muted">{{ pref.detail }}</p>
              </ion-label>
              <ion-toggle slot="end" [checked]="isEnabled(pref.key)"
                          (ionChange)="setPreference(pref.key, $any($event.detail.checked))" />
            </ion-item>
          }
        </ion-list>

        <div class="je-section-head"><h2>Security</h2></div>
        <ion-list class="je-card je-card--flush" [inset]="false">
          <ion-item lines="none" button [detail]="true" (click)="passwordOpen.set(true)">
            <ion-icon name="key-outline" slot="start" color="medium" />
            <ion-label>Change password</ion-label>
          </ion-item>
        </ion-list>

        <div class="je-section-head"><h2>Data</h2></div>
        <ion-list class="je-card je-card--flush" [inset]="false">
          <ion-item lines="full" button [detail]="false" (click)="clearCache()">
            <ion-icon name="refresh-outline" slot="start" color="medium" />
            <ion-label>Clear saved packages</ion-label>
          </ion-item>
          <ion-item lines="none" button [detail]="false" (click)="deleteAccount()">
            <ion-icon name="trash-outline" slot="start" color="danger" />
            <ion-label color="danger">Delete my account</ion-label>
          </ion-item>
        </ion-list>

        <p class="je-xs je-soft version">JoinEvents for mobile · v1.0.0</p>
      </div>
    </ion-content>

    <ion-modal [isOpen]="passwordOpen()" (didDismiss)="passwordOpen.set(false)"
               [initialBreakpoint]="0.6" [breakpoints]="[0, 0.6]">
      <ng-template>
        <ion-content class="ion-padding">
          <h2 class="sheet-title">Change password</h2>
          <form [formGroup]="passwordForm">
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="currentPassword" type="password"
                         placeholder="Current password" autocomplete="current-password" />
            </ion-item>
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="newPassword" type="password"
                         placeholder="New password" autocomplete="new-password" />
            </ion-item>
            <ion-button expand="block" class="je-btn-gradient" (click)="changePassword()" [disabled]="saving()">
              @if (saving()) { <ion-spinner name="crescent" /> } @else { Update password }
            </ion-button>
          </form>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-item { --background: var(--je-bg-card); --padding-start: 16px; }
    ion-item p { margin: 2px 0 0; }
    .version { text-align: center; padding: 24px 0; }
    .sheet-title { font-size: var(--je-fs-lg); margin: 4px 0 18px; }
  `]
})
export class SettingsPage {
  theme = inject(ThemeService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private storage = inject(StorageService);
  private favorites = inject(FavoritesService);
  private toast = inject(ToastService);

  readonly preferences = [
    { key: 'bookings', icon: 'calendar-outline', label: 'Booking updates', detail: 'Confirmations, reminders and changes' },
    { key: 'messages', icon: 'chatbubble-outline', label: 'Messages', detail: 'New messages from vendors' },
    { key: 'payments', icon: 'card-outline', label: 'Payments', detail: 'Receipts, refunds and balances due' },
    { key: 'offers', icon: 'pricetag-outline', label: 'Offers', detail: 'Deals and seasonal promotions' }
  ];

  readonly passwordOpen = signal(false);
  readonly saving = signal(false);

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  /** Preferences default to on; only an explicit opt-out is stored. */
  isEnabled(key: string): boolean {
    return this.storage.get(`joinevents_notify_${key}`) !== 'off';
  }

  setPreference(key: string, enabled: boolean): void {
    this.storage.set(`joinevents_notify_${key}`, enabled ? 'on' : 'off');
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.profileService.updatePassword(currentPassword, newPassword).subscribe(success => {
      this.saving.set(false);
      if (!success) {
        void this.toast.error('Could not update the password. Check your current one.');
        return;
      }
      this.passwordOpen.set(false);
      this.passwordForm.reset();
      void this.toast.success('Password updated.');
    });
  }

  async clearCache(): Promise<void> {
    const confirmed = await this.toast.confirm('Clear saved packages?', 'This removes every package you have saved on this device.', 'Clear', true);
    if (!confirmed) return;
    this.favorites.clear();
    void this.toast.success('Saved packages cleared.');
  }

  async deleteAccount(): Promise<void> {
    const confirmed = await this.toast.confirm(
      'Delete your account?',
      'This permanently removes your profile, bookings history and reward points. It cannot be undone.',
      'Delete',
      true
    );
    if (!confirmed) return;

    this.profileService.deleteAccount().subscribe(success => {
      if (!success) {
        void this.toast.error('We could not delete the account. Please contact support.');
        return;
      }
      void this.toast.success('Your account has been deleted.');
      this.auth.logout();
    });
  }
}
