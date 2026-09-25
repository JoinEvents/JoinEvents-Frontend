import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonInput, IonItem, IonSpinner, IonHeader, IonToolbar, IonButtons, IonBackButton
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

/** Customer sign-in. Vendors, admins and support agents use the partner portal. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, IonContent, IonButton, IonIcon, IonInput, IonItem,
    IonSpinner, IonHeader, IonToolbar, IonButtons, IonBackButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/auth/get-started" text="" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="head">
        <h1>Welcome back</h1>
        <p class="je-muted">Sign in to pick up where you left off.</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-item class="je-field" lines="none"
                  [class.je-field--invalid]="invalid('email')">
          <ion-icon name="mail-outline" slot="start" color="medium" />
          <ion-input formControlName="email" type="email" placeholder="Email address"
                     autocomplete="email" inputmode="email" enterkeyhint="next"
                     autocapitalize="none" autocorrect="off" spellcheck="false" />
        </ion-item>
        @if (invalid('email')) {
          <p class="je-error">Enter a valid email address.</p>
        }

        <ion-item class="je-field" lines="none"
                  [class.je-field--invalid]="invalid('password')">
          <ion-icon name="lock-closed-outline" slot="start" color="medium" />
          <ion-input formControlName="password" [type]="showPassword() ? 'text' : 'password'"
                     placeholder="Password" autocomplete="current-password" enterkeyhint="go"
                     autocapitalize="none" autocorrect="off" spellcheck="false" />
          <ion-icon slot="end" color="medium" [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                    (click)="showPassword.set(!showPassword())" />
        </ion-item>
        @if (invalid('password')) {
          <p class="je-error">Password must be at least 6 characters.</p>
        }

        <a class="forgot" routerLink="/auth/forgot-password">Forgot password?</a>

        <ion-button expand="block" type="submit" class="je-btn-gradient" [disabled]="busy()">
          @if (busy()) { <ion-spinner name="crescent" /> } @else { Sign in }
        </ion-button>
      </form>

      <div class="divider"><span>or</span></div>

      <ion-button expand="block" fill="outline" color="medium" (click)="notYetAvailable('Google')">
        <ion-icon name="logo-google" slot="start" />
        Continue with Google
      </ion-button>

      <p class="signup">
        New to JoinEvents? <a routerLink="/auth/register">Create an account</a>
      </p>
      <p class="signup">
        <a routerLink="/auth/partner-login">Vendor / staff sign in</a>
      </p>
    </ion-content>
  `,
  styles: [`
    .head { margin: 8px 0 26px; }
    .head h1 { font-size: var(--je-fs-2xl); margin: 0 0 6px; }
    .head p { margin: 0; font-size: var(--je-fs-base); }
    ion-item.je-field ion-icon[slot="end"] { font-size: 19px; }
    .forgot {
      display: block; text-align: right; margin: -4px 2px 20px;
      color: var(--je-primary); font-size: var(--je-fs-sm); font-weight: 600; text-decoration: none;
    }
    .divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; color: var(--je-text-soft); font-size: var(--je-fs-sm); }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--je-border-color); }
    .signup { text-align: center; font-size: var(--je-fs-sm); color: var(--je-text-muted); margin: 18px 0 0; }
    .signup a { color: var(--je-primary); font-weight: 600; text-decoration: none; }
  `]
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  invalid(control: 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.dirty || field.touched);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password, 'customer').subscribe(result => {
      this.busy.set(false);
      if (!result.success) {
        void this.toast.error(result.message);
        return;
      }
      // Signed in: go straight to the app; landing there is the confirmation.
      // Honour a returnUrl set by the guard so a deep link resumes after login.
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      void this.router.navigateByUrl(this.isSafeReturnUrl(returnUrl) ? returnUrl! : this.auth.homeRoute(), {
        replaceUrl: true
      });
    });
  }

  notYetAvailable(provider: string): void {
    void this.toast.info(`${provider} sign-in is coming soon.`);
  }

  /** Only relative in-app paths — never a protocol-relative or absolute URL. */
  private isSafeReturnUrl(url: string | null): boolean {
    return !!url && url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
  }
}
