import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonChip, IonLabel, IonDatetime, IonModal
} from '@ionic/angular/standalone';

import { RfpService } from '../../core/services/rfp.service';
import { PackageService } from '../../core/services/package.service';
import { ToastService } from '../../core/services/toast.service';
import { EventType } from '../../core/models/event.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

const SERVICE_OPTIONS = [
  'Venue', 'Catering', 'Decor', 'Photography', 'Videography', 'Music & DJ',
  'Makeup & Styling', 'Invitations', 'Transport', 'Accommodation', 'Anchor / Host', 'Security'
];

/**
 * Create or edit a quote request. The same page serves both — the presence of
 * an `:id` route parameter decides which, exactly as the web app does.
 */
@Component({
  selector: 'app-create-quote',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyInrPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonChip, IonLabel,
    IonDatetime, IonModal
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/quotes" text="" />
        </ion-buttons>
        <ion-title>{{ editing() ? 'Edit request' : 'New quote request' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <p class="lead je-sm je-muted">
          Tell us what you need once — verified vendors will send you offers to compare.
        </p>

        <form [formGroup]="form">
          <ion-item class="je-field" lines="none">
            <ion-icon name="text-outline" slot="start" color="medium" />
            <ion-input formControlName="title" placeholder="Give your request a title" />
          </ion-item>

          <ion-item class="je-field" lines="none">
            <ion-icon name="sparkles-outline" slot="start" color="medium" />
            <ion-select formControlName="eventTypeId" placeholder="Event type" interface="action-sheet">
              @for (type of eventTypes(); track type.id) {
                <ion-select-option [value]="type.id">{{ type.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item class="je-field" lines="none" button (click)="datePickerOpen.set(true)">
            <ion-icon name="calendar-outline" slot="start" color="medium" />
            <ion-label [class.placeholder]="!form.controls.eventDate.value">
              {{ form.controls.eventDate.value ? displayDate() : 'Event date' }}
            </ion-label>
          </ion-item>

          <ion-item class="je-field" lines="none">
            <ion-icon name="location-outline" slot="start" color="medium" />
            <ion-input formControlName="city" placeholder="City" />
          </ion-item>

          <ion-item class="je-field" lines="none">
            <ion-icon name="business-outline" slot="start" color="medium" />
            <ion-select formControlName="venueStatus" placeholder="Venue status" interface="action-sheet">
              <ion-select-option value="booked">Venue already booked</ion-select-option>
              <ion-select-option value="not_booked">Still looking for a venue</ion-select-option>
            </ion-select>
          </ion-item>

          @if (form.controls.venueStatus.value === 'booked') {
            <ion-item class="je-field" lines="none">
              <ion-icon name="pin-outline" slot="start" color="medium" />
              <ion-input formControlName="venueName" placeholder="Venue name" />
            </ion-item>
          }

          <ion-item class="je-field" lines="none">
            <ion-icon name="people-outline" slot="start" color="medium" />
            <ion-input formControlName="guestCount" type="number" inputmode="numeric" placeholder="Guest count" />
          </ion-item>

          <div class="budget">
            <ion-item class="je-field budget__field" lines="none">
              <ion-input formControlName="budgetMin" type="number" inputmode="numeric" placeholder="Min budget" />
            </ion-item>
            <span class="budget__sep">to</span>
            <ion-item class="je-field budget__field" lines="none">
              <ion-input formControlName="budgetMax" type="number" inputmode="numeric" placeholder="Max budget" />
            </ion-item>
          </div>
          @if (budgetInvalid()) {
            <p class="je-error">The maximum budget must be higher than the minimum.</p>
          }
          @if (form.controls.budgetMax.value > 0) {
            <p class="je-xs je-soft budget__hint">
              Vendors will see a range of {{ form.controls.budgetMin.value | inr }} –
              {{ form.controls.budgetMax.value | inr }}.
            </p>
          }

          <!-- Services ---------------------------------------------------- -->
          <div class="je-section-head"><h2>What do you need?</h2></div>
          <div class="services">
            @for (service of serviceOptions; track service) {
              <ion-chip [outline]="!selected().includes(service)" (click)="toggleService(service)">
                <ion-label>{{ service }}</ion-label>
                @if (selected().includes(service)) { <ion-icon name="checkmark" /> }
              </ion-chip>
            }
          </div>
          @if (!selected().length) {
            <p class="je-xs je-soft">Pick at least one service so vendors know what to quote for.</p>
          }

          <ion-item class="je-field req" lines="none">
            <ion-textarea formControlName="requirements" [rows]="4" [autoGrow]="true"
                          placeholder="Anything else vendors should know — themes, timings, dietary needs…" />
          </ion-item>
        </form>
      </div>

      <div class="je-action-bar">
        <ion-button expand="block" class="je-btn-gradient submit" (click)="submit()" [disabled]="saving()">
          @if (saving()) { <ion-spinner name="crescent" /> }
          @else { {{ editing() ? 'Save changes' : 'Post request' }} }
        </ion-button>
      </div>
    </ion-content>

    <ion-modal [isOpen]="datePickerOpen()" (didDismiss)="datePickerOpen.set(false)"
               [initialBreakpoint]="0.6" [breakpoints]="[0, 0.6]">
      <ng-template>
        <ion-content class="ion-padding">
          <ion-datetime presentation="date" [min]="minDate"
                        (ionChange)="onDateChosen($any($event.detail.value))" />
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .lead { margin: 8px 0 20px; line-height: 1.55; }
    .placeholder { color: var(--je-text-soft); }
    .budget { display: flex; align-items: center; gap: 10px; }
    .budget__field { flex: 1; }
    .budget__sep { color: var(--je-text-soft); font-size: var(--je-fs-sm); padding-bottom: 14px; }
    .budget__hint { margin: -6px 0 14px 4px; }
    .services { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    ion-chip { --background: var(--je-primary); --color: #fff; font-weight: 600; margin: 0; }
    ion-chip[outline] { --background: transparent; --color: var(--je-text-muted); }
    .req { margin-top: 16px; }
    .submit { margin: 0; width: 100%; }
  `]
})
export class CreateQuotePage implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private rfpService = inject(RfpService);
  private packageService = inject(PackageService);
  private toast = inject(ToastService);

  readonly serviceOptions = SERVICE_OPTIONS;
  readonly minDate = new Date().toISOString().slice(0, 10);

  readonly saving = signal(false);
  readonly eventTypes = signal<EventType[]>([]);
  readonly selected = signal<string[]>([]);
  readonly datePickerOpen = signal(false);
  readonly editing = signal(false);

  private editId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    eventTypeId: ['', Validators.required],
    eventDate: ['', Validators.required],
    city: ['', Validators.required],
    venueStatus: ['not_booked'],
    venueName: [''],
    guestCount: [50, [Validators.required, Validators.min(1)]],
    budgetMin: [0, [Validators.required, Validators.min(0)]],
    budgetMax: [0, [Validators.required, Validators.min(1)]],
    requirements: ['']
  });

  ngOnInit(): void {
    this.packageService.getEventTypes().subscribe(types => this.eventTypes.set(types));

    this.editId = this.route.snapshot.paramMap.get('id');
    if (!this.editId) return;

    this.editing.set(true);
    this.rfpService.getById(this.editId).subscribe(quote => {
      if (!quote) return;
      this.form.patchValue({
        title: quote.title,
        eventTypeId: quote.eventTypeId,
        eventDate: quote.eventDate?.slice(0, 10),
        city: quote.city,
        venueStatus: quote.venueStatus ?? 'not_booked',
        venueName: quote.venueName ?? '',
        guestCount: quote.guestCount,
        budgetMin: quote.budgetMin,
        budgetMax: quote.budgetMax,
        requirements: quote.requirements
      });
      this.selected.set(quote.servicesNeeded ?? []);
    });
  }

  displayDate(): string {
    const value = this.form.controls.eventDate.value;
    return value
      ? new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
      : '';
  }

  onDateChosen(value: string | string[] | null): void {
    const date = Array.isArray(value) ? value[0] : value;
    if (!date) return;
    this.form.controls.eventDate.setValue(date.slice(0, 10));
    this.datePickerOpen.set(false);
  }

  toggleService(service: string): void {
    this.selected.update(list => (list.includes(service) ? list.filter(s => s !== service) : [...list, service]));
  }

  budgetInvalid(): boolean {
    const { budgetMin, budgetMax } = this.form.getRawValue();
    return budgetMax > 0 && budgetMax <= budgetMin;
  }

  submit(): void {
    if (this.form.invalid || this.budgetInvalid() || !this.selected().length) {
      this.form.markAllAsTouched();
      void this.toast.error('Complete the form and pick at least one service.');
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      title: value.title,
      eventTypeId: value.eventTypeId,
      eventDate: value.eventDate,
      city: value.city,
      venueStatus: value.venueStatus as 'booked' | 'not_booked',
      venueName: value.venueName || undefined,
      guestCount: value.guestCount,
      budgetMin: value.budgetMin,
      budgetMax: value.budgetMax,
      requirements: value.requirements,
      servicesNeeded: this.selected()
    };

    const request$ = this.editId
      ? this.rfpService.update(this.editId, payload)
      : this.rfpService.create(payload);

    request$.subscribe(result => {
      this.saving.set(false);
      if (!result) {
        void this.toast.error('We could not save your request. Please try again.');
        return;
      }
      void this.toast.success(this.editing() ? 'Request updated.' : 'Request posted — vendors can now bid.');
      void this.router.navigate(['/customer/quotes'], { replaceUrl: true });
    });
  }
}
