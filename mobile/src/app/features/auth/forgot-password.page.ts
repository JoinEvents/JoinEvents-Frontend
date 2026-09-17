import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonInput, IonItem, IonSpinner,
  IonHeader, IonToolbar, IonButtons, IonBackButton
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Two-step reset: request a code, then set a new password with it. The second
 * step only unlocks after the request succeeds, so the form cannot be
 * submitted against a code that was never sent.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule, IonContent, IonButton, IonIcon, IonInput, IonItem, IonSpinner,
    IonHeader, IonToolbar, IonButtons, IonBackButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/auth/login" text="" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="head">
        <h1>{{ sent() ? 'Set a new password' : 'Reset your password' }}</h1>
        <p class="je-muted">
          {{ sent()
            ? 'Enter the code we sent to ' + requestForm.controls.email.value + ' and choose a new password.'
            : 'We will email you a verification code.' }}
        </p>
      </div>

      @if (!sent()) {
        <form [formGroup]="requestForm" (ngSubmit)="requestCode()">
          <ion-item class="je-field" lines="none">
            <ion-icon name="mail-outline" slot="start" color="medium" />
            <ion-input formControlName="email" type="email" placeholder="Email address" inputmode="email" />
          </ion-item>
          <ion-button expand="block" type="submit" class="je-btn-gradient" [disabled]="busy()">
            @if (busy()) { <ion-spinner name="crescent" /> } @else { Send code }
          </ion-button>
        </form>
      } @else {
        <form [formGroup]="resetForm" (ngSubmit)="resetPassword()">
          <ion-item class="je-field" lines="none">
            <ion-icon name="keypad-outline" slot="start" color="medium" />
            <ion-input formControlName="otp" placeholder="6-digit code" inputmode="numeric" maxlength="6" />
          </ion-item>
          <ion-item class="je-field" lines="none">
            <ion-icon name="lock-closed-outline" slot="start" color="medium" />
            <ion-input formControlName="newPassword" type="password"
                       placeholder="New password" autocomplete="new-password" />
          </ion-item>
          <ion-button expand="block" type="submit" class="je-btn-gradient" [disabled]="busy()">
            @if (busy()) { <ion-spinner name="crescent" /> } @else { Update password }
          </ion-button>
          <ion-button expand="block" fill="clear" color="medium" (click)="requestCode()" [disabled]="busy()">
            Resend code
          </ion-button>
        </form>
      }
    </ion-content>
  `,
  styles: [`
    .head { margin: 8px 0 26px; }
    .head h1 { font-size: var(--je-fs-2xl); margin: 0 0 6px; }
    .head p { margin: 0; font-size: var(--je-fs-base); line-height: 1.5; }
  `]
})
export class ForgotPasswordPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly busy = signal(false);
  readonly sent = signal(false);

  readonly requestForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  readonly resetForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.minLength(4)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  requestCode(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.auth.requestPasswordReset(this.requestForm.controls.email.value).subscribe(result => {
      this.busy.set(false);
      if (!result.success) {
        void this.toast.error(result.message);
        return;
      }
      this.sent.set(true);
      void this.toast.success(result.message);
    });
  }

  resetPassword(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const { otp, newPassword } = this.resetForm.getRawValue();

    this.auth.resetPassword(this.requestForm.controls.email.value, otp, newPassword).subscribe(result => {
      this.busy.set(false);
      if (!result.success) {
        void this.toast.error(result.message);
        return;
      }
      void this.toast.success('Password updated. Please sign in.');
      void this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    });
  }
}
