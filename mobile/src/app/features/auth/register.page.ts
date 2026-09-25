import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonInput, IonItem, IonSpinner, IonCheckbox,
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, IonContent, IonButton, IonIcon, IonInput, IonItem, IonSpinner,
    IonCheckbox, IonHeader, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel
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
        <h1>Create your account</h1>
        <p class="je-muted">It takes less than a minute.</p>
      </div>

      <ion-segment [value]="role()" (ionChange)="setRole($any($event.detail.value))" class="roles">
        <ion-segment-button value="customer"><ion-label>I'm planning</ion-label></ion-segment-button>
        <ion-segment-button value="vendor"><ion-label>I'm a vendor</ion-label></ion-segment-button>
      </ion-segment>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-item class="je-field" lines="none">
          <ion-icon name="person-outline" slot="start" color="medium" />
          <ion-input formControlName="name" placeholder="Full name" autocomplete="name" />
        </ion-item>

        @if (role() === 'vendor') {
          <ion-item class="je-field" lines="none">
            <ion-icon name="storefront-outline" slot="start" color="medium" />
            <ion-input formControlName="businessName" placeholder="Business name" autocomplete="organization" />
          </ion-item>
        }

        <ion-item class="je-field" lines="none">
          <ion-icon name="mail-outline" slot="start" color="medium" />
          <ion-input formControlName="email" type="email" placeholder="Email address"
                     autocomplete="email" inputmode="email"
                     autocapitalize="none" autocorrect="off" spellcheck="false" />
        </ion-item>

        <ion-item class="je-field" lines="none">
          <ion-icon name="call-outline" slot="start" color="medium" />
          <ion-input formControlName="phone" type="tel" placeholder="10-digit mobile number"
                     autocomplete="tel" inputmode="numeric" maxlength="10" />
        </ion-item>

        <ion-item class="je-field" lines="none">
          <ion-icon name="location-outline" slot="start" color="medium" />
          <ion-input formControlName="city" placeholder="City" autocomplete="address-level2" />
        </ion-item>

        <ion-item class="je-field" lines="none">
          <ion-icon name="lock-closed-outline" slot="start" color="medium" />
          <ion-input formControlName="password" [type]="showPassword() ? 'text' : 'password'"
                     placeholder="Password" autocomplete="new-password"
                     autocapitalize="none" autocorrect="off" spellcheck="false" />
          <ion-icon slot="end" color="medium" [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                    (click)="showPassword.set(!showPassword())" />
        </ion-item>

        <ion-item class="je-field" lines="none">
          <ion-icon name="shield-checkmark-outline" slot="start" color="medium" />
          <ion-input formControlName="confirmPassword" type="password"
                     placeholder="Confirm password" autocomplete="new-password" />
        </ion-item>
        @if (form.hasError('mismatch') && form.controls.confirmPassword.touched) {
          <p class="je-error">Passwords do not match.</p>
        }

        <ion-item class="je-field" lines="none">
          <ion-icon name="gift-outline" slot="start" color="medium" />
          <ion-input formControlName="referralCode" placeholder="Referral code (optional)" />
        </ion-item>

        <ion-item lines="none" class="terms">
          <ion-checkbox formControlName="acceptedTerms" labelPlacement="end" justify="start">
            <span class="je-sm">I agree to the Terms of Service and Privacy Policy</span>
          </ion-checkbox>
        </ion-item>

        <ion-button expand="block" type="submit" class="je-btn-gradient" [disabled]="busy()">
          @if (busy()) { <ion-spinner name="crescent" /> } @else { Create account }
        </ion-button>
      </form>

      <p class="signup">Already registered? <a routerLink="/auth/login">Sign in</a></p>
    </ion-content>
  `,
  styles: [`
    .head { margin: 8px 0 20px; }
    .head h1 { font-size: var(--je-fs-2xl); margin: 0 0 6px; }
    .head p { margin: 0; font-size: var(--je-fs-base); }
    .roles { margin-bottom: 20px; --background: var(--je-bg-light); border-radius: var(--je-radius-sm); }
    .terms { --background: transparent; --padding-start: 0; margin: 4px 0 18px; }
    .signup { text-align: center; font-size: var(--je-fs-sm); color: var(--je-text-muted); margin-top: 20px; }
    .signup a { color: var(--je-primary); font-weight: 600; text-decoration: none; }
  `]
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly role = signal<UserRole>(
    (this.route.snapshot.queryParamMap.get('role') as UserRole) ?? 'customer'
  );

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      businessName: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      city: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      referralCode: [this.route.snapshot.queryParamMap.get('ref') ?? ''],
      acceptedTerms: [false, Validators.requiredTrue]
    },
    { validators: passwordsMatch }
  );

  setRole(role: UserRole): void {
    this.role.set(role);
    const businessName = this.form.controls.businessName;
    // A vendor account needs a trading name; a customer account does not.
    businessName.setValidators(role === 'vendor' ? [Validators.required] : []);
    businessName.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.toast.error('Please complete every required field.');
      return;
    }
    this.busy.set(true);
    const value = this.form.getRawValue();

    this.auth
      .register({
        name: value.name,
        email: value.email,
        phone: value.phone,
        password: value.password,
        role: this.role(),
        city: value.city,
        businessName: this.role() === 'vendor' ? value.businessName : undefined,
        referralCode: value.referralCode || undefined
      })
      .subscribe(result => {
        this.busy.set(false);
        if (!result.success) {
          void this.toast.error(result.message);
          return;
        }
        void this.toast.success(result.message);
        void this.router.navigateByUrl(this.auth.homeRoute(), { replaceUrl: true });
      });
  }
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}
