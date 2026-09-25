import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
  IonItem, IonInput, IonTextarea, IonSpinner, IonNote, IonFooter, NavController
} from '@ionic/angular/standalone';

import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { VendorBusinessProfile } from '../../core/models/user.model';
import { PLACEHOLDER_BUSINESS_NAME, profileGaps } from '../../core/utils/vendor-readiness.util';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';

/**
 * The vendor's business details — the web console's vendor Profile fields that
 * the API stores. A business name and description are required before the API
 * accepts a package, so this page says exactly what is still missing.
 */
@Component({
  selector: 'app-vendor-business-profile',
  standalone: true,
  imports: [
    ListSkeletonComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
    IonItem, IonInput, IonTextarea, IonSpinner, IonNote, IonFooter
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/vendor/tabs/more" text="" /></ion-buttons>
        <ion-title>Business profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="je-section"><app-list-skeleton [count]="4" /></div>
      } @else {
        <div class="je-section">
          @if (gaps().length) {
            <div class="je-card notice">
              <strong class="je-sm">Needed before you can list packages</strong>
              <span class="je-xs je-muted">{{ gaps().join(' and ') }}.</span>
            </div>
          }

          <label class="flabel">Business name *</label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="businessName()" (ionInput)="businessName.set($any($event.target).value ?? '')"
                       placeholder="e.g. Royal Banquets" />
          </ion-item>

          <label class="flabel">Business description *</label>
          <ion-item class="je-field" lines="none">
            <ion-textarea [value]="description()" (ionInput)="description.set($any($event.target).value ?? '')"
                          [rows]="5" [autoGrow]="true"
                          placeholder="What you offer, your experience, what makes you different" />
          </ion-item>
          <ion-note class="je-xs hint">Customers see this on your packages.</ion-note>

          <label class="flabel">Contact person</label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="name()" (ionInput)="name.set($any($event.target).value ?? '')"
                       placeholder="Your name" />
          </ion-item>

          <label class="flabel">Phone</label>
          <ion-item class="je-field" lines="none">
            <ion-input type="tel" inputmode="tel" [value]="phone()"
                       (ionInput)="phone.set($any($event.target).value ?? '')" placeholder="Phone number" />
          </ion-item>

          <label class="flabel">City</label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="city()" (ionInput)="city.set($any($event.target).value ?? '')"
                       placeholder="City you operate from" />
          </ion-item>

          <label class="flabel">Business email</label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="email()" [readonly]="true" />
          </ion-item>
          <ion-note class="je-xs hint">Your sign-in email can't be changed here.</ion-note>
        </div>

      }
    </ion-content>

    @if (!loading()) {
      <ion-footer class="ion-no-border">
        <div class="je-action-bar">
          <ion-button expand="block" class="je-btn-gradient submit" (click)="save()" [disabled]="saving()">
            @if (saving()) { <ion-spinner name="crescent" /> } @else { Save profile }
          </ion-button>
        </div>
      </ion-footer>
    }
  `,
  styles: [`
    .flabel { display: block; font-size: var(--je-fs-xs); font-weight: 700; color: var(--je-text-muted);
              margin: 12px 2px 6px; }
    .hint { display: block; margin: -4px 4px 4px; }
    .notice { display: flex; flex-direction: column; gap: 3px; border-left: 3px solid var(--je-warning); }
    .submit { margin: 0; width: 100%; }
  `]
})
export class VendorBusinessProfilePage implements OnInit {
  private profileService = inject(ProfileService);
  private toast = inject(ToastService);
  private nav = inject(NavController);

  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly businessName = signal('');
  readonly description = signal('');
  readonly name = signal('');
  readonly phone = signal('');
  readonly city = signal('');
  readonly email = signal('');

  readonly gaps = computed(() => profileGaps({ businessName: this.businessName(), description: this.description() }));

  ngOnInit(): void {
    this.profileService.getProfile().subscribe(raw => {
      const profile = raw as unknown as VendorBusinessProfile | null;
      if (!profile) void this.toast.error('Could not load your profile. Pull back and try again.');
      // The API's placeholder name is shown as empty so the vendor enters a real one.
      const business = profile?.businessName ?? '';
      this.businessName.set(business === PLACEHOLDER_BUSINESS_NAME ? '' : business);
      this.description.set(profile?.description ?? '');
      this.name.set(profile?.name ?? '');
      this.phone.set(profile?.phone ?? '');
      this.city.set(profile?.city ?? '');
      this.email.set(profile?.email ?? '');
      this.loading.set(false);
    });
  }

  save(): void {
    const gaps = this.gaps();
    if (gaps.length) {
      void this.toast.error(`Enter your ${gaps.join(' and ').toLowerCase()}.`);
      return;
    }
    if (!this.name().trim()) {
      void this.toast.error('Enter a contact name.');
      return;
    }
    this.saving.set(true);
    this.profileService.saveProfile({
      businessName: this.businessName().trim(),
      description: this.description().trim(),
      name: this.name().trim(),
      phone: this.phone().trim(),
      city: this.city().trim()
    }).subscribe(error => {
      this.saving.set(false);
      if (error) {
        void this.toast.error(error);
        return;
      }
      void this.toast.success('Business profile saved.');
      this.nav.back();
    });
  }
}
