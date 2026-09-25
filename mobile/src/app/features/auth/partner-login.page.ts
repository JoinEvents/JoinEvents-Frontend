import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonInput, IonItem, IonSpinner,
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserRole } from '../../core/models/user.model';

/**
 * Sign-in for vendors, admins and support agents — the mobile equivalent of
 * the web app's `/partner-login`. The role is part of the credential check, so
 * it is picked explicitly rather than inferred.
 */
@Component({
  selector: 'app-partner-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, IonContent, IonButton, IonIcon, IonInput, IonItem, IonSpinner,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel
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
        <h1>Partner sign in</h1>
        <p class="je-muted">For vendors and JoinEvents staff.</p>
      </div>

      <ion-segment [value]="role()" (ionChange)="role.set($any($event.detail.value))" class="roles">
        <ion-segment-button value="vendor"><ion-label>Vendor</ion-label></ion-segment-button>
        <ion-segment-button value="support"><ion-label>Support</ion-label></ion-segment-button>
        <ion-segment-button value="admin"><ion-label>Admin</ion-label></ion-segment-button>
      </ion-segment>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-item class="je-field" lines="none">
          <ion-icon name="mail-outline" slot="start" color="medium" />
          <ion-input formControlName="email" type="email" placeholder="Work email"
                     autocomplete="email" inputmode="email"
                     autocapitalize="none" autocorrect="off" spellcheck="false" />
        </ion-item>

        <ion-item class="je-field" lines="none">
          <ion-icon name="lock-closed-outline" slot="start" color="medium" />
          <ion-input formControlName="password" [type]="showPassword() ? 'text' : 'password'"
                     placeholder="Password" autocomplete="current-password"
                     autocapitalize="none" autocorrect="off" spellcheck="false" />
          <ion-icon slot="end" color="medium" [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                    (click)="showPassword.set(!showPassword())" />
        </ion-item>

        <ion-button expand="block" type="submit" class="je-btn-gradient" [disabled]="busy()">
          @if (busy()) { <ion-spinner name="crescent" /> } @else { Sign in as {{ role() }} }
        </ion-button>
      </form>

      <p class="signup">
        Want to list your services? <a routerLink="/auth/register" [queryParams]="{ role: 'vendor' }">Register as a vendor</a>
      </p>
    </ion-content>
  `,
  styles: [`
    .head { margin: 8px 0 20px; }
    .head h1 { font-size: var(--je-fs-2xl); margin: 0 0 6px; }
    .head p { margin: 0; font-size: var(--je-fs-base); }
    .roles { margin-bottom: 22px; --background: var(--je-bg-light); border-radius: var(--je-radius-sm); }
    .signup { text-align: center; font-size: var(--je-fs-sm); color: var(--je-text-muted); margin-top: 22px; }
    .signup a { color: var(--je-primary); font-weight: 600; text-decoration: none; }
  `]
})
export class PartnerLoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly role = signal<UserRole>('vendor');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.toast.error('Enter your email and password.');
      return;
    }
    this.busy.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password, this.role()).subscribe(result => {
      this.busy.set(false);
      if (!result.success) {
        void this.toast.error(result.message);
        return;
      }
      // Signed in: go straight to the app; landing there is the confirmation.
      void this.router.navigateByUrl(this.auth.homeRoute(), { replaceUrl: true });
    });
  }
}
