import { Component, computed, input, model, output } from '@angular/core';
import {
  IonItem, IonInput, IonTextarea, IonToggle, IonSegment, IonSegmentButton, IonLabel, IonIcon
} from '@ionic/angular/standalone';

import { Tier } from '../../../core/models/catalogue.model';
import {
  CuisineType, InclusionDetail, PackageDraft, inclusionKind, syncDerivedPrices, tierLimit
} from '../../../core/utils/package-draft.util';
import { TagListComponent } from '../../../shared/components/tag-list.component';
import { PhotoGridComponent } from './photo-grid.component';

type NumericField = 'vegPrice' | 'nonVegPrice' | 'rent' | 'maxGuests' | 'totalRooms' | 'roomPrice' | 'parkingCapacity';
type TextField = 'cuisine' | 'cateringPolicy' | 'decorPolicy' | 'alcoholPolicy' | 'djPolicy';
type AmenityField = 'hasAc' | 'hasPowerBackup' | 'hasChangingRooms' | 'hasParking';

/**
 * One selected service's details, as the web form's inclusion tab: a
 * description, its price (per plate for catering, rent for a venue), photos,
 * key features and what it includes — checked live against the tier's range.
 */
@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [
    TagListComponent, PhotoGridComponent,
    IonItem, IonInput, IonTextarea, IonToggle, IonSegment, IonSegmentButton, IonLabel, IonIcon
  ],
  template: `
    <div class="je-card svc" [class.svc--open]="expanded()" [class.svc--bad]="!!problem()">
      <button type="button" class="svc__head" (click)="toggle.emit()">
        <span class="svc__title">
          <strong class="je-sm">{{ name() }}</strong>
          <span class="je-xs" [class.je-muted]="!problem()" [class.bad]="!!problem()">
            {{ problem() || summary() }}
          </span>
        </span>
        <ion-icon [name]="expanded() ? 'chevron-up' : 'chevron-down'" />
      </button>

      @if (expanded()) {
        <div class="svc__body">
          <label class="flabel">Description *</label>
          <ion-item class="je-field" lines="none">
            <ion-textarea [value]="detail().description" [rows]="3" [autoGrow]="true"
                          placeholder="What exactly does this service include?"
                          (ionInput)="setDetail('description', $any($event.target).value ?? '')" />
          </ion-item>

          @switch (kind()) {
            @case ('catering') {
              <label class="flabel">Cuisine *</label>
              <ion-item class="je-field" lines="none">
                <ion-input [value]="draft().cuisine" placeholder="e.g. South Indian, Multicuisine"
                           (ionInput)="setText('cuisine', $any($event.target).value)" />
              </ion-item>
              <label class="flabel">Food type *</label>
              <ion-segment [value]="draft().cuisineType" (ionChange)="setCuisineType($any($event.detail.value))">
                <ion-segment-button value="veg"><ion-label>Veg</ion-label></ion-segment-button>
                <ion-segment-button value="nonveg"><ion-label>Non-veg</ion-label></ion-segment-button>
                <ion-segment-button value="mixed"><ion-label>Both</ion-label></ion-segment-button>
              </ion-segment>
              <div class="pair">
                @if (draft().cuisineType !== 'nonveg') {
                  <ion-item class="je-field" lines="none">
                    <ion-input type="number" inputmode="numeric" label="Veg / plate ₹ *" labelPlacement="stacked"
                               [value]="draft().vegPrice || null" (ionInput)="setNumber('vegPrice', $any($event.target).value)" />
                  </ion-item>
                }
                @if (draft().cuisineType !== 'veg') {
                  <ion-item class="je-field" lines="none">
                    <ion-input type="number" inputmode="numeric" label="Non-veg / plate ₹ *" labelPlacement="stacked"
                               [value]="draft().nonVegPrice || null" (ionInput)="setNumber('nonVegPrice', $any($event.target).value)" />
                  </ion-item>
                }
              </div>
            }
            @case ('venue') {
              <div class="pair">
                <ion-item class="je-field" lines="none">
                  <ion-input type="number" inputmode="numeric" label="Rent ₹ *" labelPlacement="stacked"
                             [value]="draft().rent || null" (ionInput)="setNumber('rent', $any($event.target).value)" />
                </ion-item>
                <ion-item class="je-field" lines="none">
                  <ion-input type="number" inputmode="numeric" label="Max guests *" labelPlacement="stacked"
                             [value]="draft().maxGuests || null" (ionInput)="setNumber('maxGuests', $any($event.target).value)" />
                </ion-item>
                <ion-item class="je-field" lines="none">
                  <ion-input type="number" inputmode="numeric" label="Rooms" labelPlacement="stacked"
                             [value]="draft().totalRooms || null" (ionInput)="setNumber('totalRooms', $any($event.target).value)" />
                </ion-item>
                <ion-item class="je-field" lines="none">
                  <ion-input type="number" inputmode="numeric" label="Avg room price ₹" labelPlacement="stacked"
                             [value]="draft().roomPrice || null" (ionInput)="setNumber('roomPrice', $any($event.target).value)" />
                </ion-item>
                <ion-item class="je-field" lines="none">
                  <ion-input type="number" inputmode="numeric" label="Parking (cars)" labelPlacement="stacked"
                             [value]="draft().parkingCapacity || null" (ionInput)="setNumber('parkingCapacity', $any($event.target).value)" />
                </ion-item>
              </div>

              <label class="flabel">Policies</label>
              @for (p of policies; track p.field) {
                <ion-item class="je-field" lines="none">
                  <ion-input [label]="p.label" labelPlacement="stacked" [value]="draft()[p.field]"
                             [placeholder]="p.hint" (ionInput)="setText(p.field, $any($event.target).value)" />
                </ion-item>
              }

              <label class="flabel">Amenities</label>
              <div class="je-card je-card--flush amenities">
                @for (a of amenities; track a.field) {
                  <ion-item lines="full">
                    <ion-toggle [checked]="draft()[a.field]" (ionChange)="setAmenity(a.field, $any($event.detail.checked))">
                      <span class="je-sm">{{ a.label }}</span>
                    </ion-toggle>
                  </ion-item>
                }
              </div>
            }
            @default {
              <ion-item class="je-field" lines="none">
                <ion-input type="number" inputmode="numeric" label="Price ₹ *" labelPlacement="stacked"
                           [value]="detail().minPrice || null" (ionInput)="setPrice($any($event.target).value)" />
              </ion-item>
            }
          }

          @if (limit(); as l) {
            <p class="je-xs range" [class.bad]="rangeError()">
              {{ tier()?.name }} tier range: ₹{{ l.minPrice.toLocaleString('en-IN') }} – ₹{{ l.maxPrice.toLocaleString('en-IN') }}
              @if (rangeError()) { · {{ rangeError() }} }
            </p>
          }

          <label class="flabel">Photos * <span class="je-soft">(up to 5)</span></label>
          <app-photo-grid [photos]="detail().images" (photosChange)="setDetail('images', $event)"
                          [max]="5" (busy)="busy.emit($event)" />

          <label class="flabel">Key features / highlights *</label>
          <app-tag-list [value]="detail().keyFeatures" (valueChange)="setDetail('keyFeatures', $event)"
                        placeholder="e.g. Live counters — press enter" />

          <label class="flabel">What's included</label>
          <app-tag-list [value]="detail().inclusions" (valueChange)="setDetail('inclusions', $event)"
                        placeholder="e.g. Welcome drinks — press enter" />
        </div>
      }
    </div>
  `,
  styles: [`
    .svc { padding: 0; overflow: hidden; margin-bottom: 10px; }
    .svc--bad { border: 1px solid var(--je-danger); }
    .svc__head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
                 padding: 12px 14px; background: none; border: none; color: var(--je-text-main); text-align: left; }
    .svc__title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .svc__body { padding: 0 14px 14px; }
    .flabel { display: block; font-size: var(--je-fs-xs); font-weight: 700; color: var(--je-text-muted);
              margin: 12px 2px 6px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
    .range { margin: 8px 2px 0; color: var(--je-text-muted); }
    .bad { color: var(--je-danger); }
    .amenities ion-item { --background: transparent; }
  `]
})
export class ServiceDetailComponent {
  readonly name = input.required<string>();
  readonly draft = model.required<PackageDraft>();
  readonly tier = input<Tier | null>(null);
  readonly expanded = input(false);
  readonly problem = input<string | null>(null);
  readonly toggle = output<void>();
  readonly busy = output<boolean>();

  /** Field labels only; the values vendors type are free text. */
  readonly policies: { field: TextField; label: string; hint: string }[] = [
    { field: 'cateringPolicy', label: 'Catering policy', hint: 'e.g. In-house only' },
    { field: 'alcoholPolicy', label: 'Alcohol policy', hint: 'e.g. Outside allowed' },
    { field: 'decorPolicy', label: 'Decor policy', hint: 'e.g. Panel decorators only' },
    { field: 'djPolicy', label: 'DJ policy', hint: 'e.g. In-house DJ only' }
  ];
  readonly amenities: { field: AmenityField; label: string }[] = [
    { field: 'hasAc', label: 'Air conditioning' },
    { field: 'hasPowerBackup', label: 'Power backup' },
    { field: 'hasChangingRooms', label: 'Changing rooms' },
    { field: 'hasParking', label: 'Parking' }
  ];

  readonly kind = computed(() => inclusionKind(this.name()));
  readonly detail = computed<InclusionDetail>(() => this.draft().details[this.name()]);
  readonly limit = computed(() => tierLimit(this.tier(), this.name()));

  readonly rangeError = computed(() => {
    const l = this.limit();
    const d = this.detail();
    if (!l || !d || !d.minPrice) return null;
    if (d.minPrice < l.minPrice) return 'below the minimum';
    if (l.maxPrice > 0 && d.maxPrice > l.maxPrice) return 'above the maximum';
    return null;
  });

  readonly summary = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const price = d.minPrice
      ? (d.maxPrice > d.minPrice ? `₹${d.minPrice.toLocaleString('en-IN')} – ₹${d.maxPrice.toLocaleString('en-IN')}` : `₹${d.minPrice.toLocaleString('en-IN')}`)
      : 'No price yet';
    return `${price}${this.kind() === 'catering' ? ' / plate' : ''} · ${d.images.length} photo${d.images.length === 1 ? '' : 's'}`;
  });

  setDetail<K extends keyof InclusionDetail>(field: K, value: InclusionDetail[K]): void {
    const d = this.draft();
    this.draft.set({ ...d, details: { ...d.details, [this.name()]: { ...d.details[this.name()], [field]: value } } });
  }

  setPrice(raw: string | number | null | undefined): void {
    const price = toNumber(raw);
    const d = this.draft();
    this.draft.set(syncDerivedPrices({
      ...d, details: { ...d.details, [this.name()]: { ...d.details[this.name()], minPrice: price, maxPrice: price } }
    }));
  }

  setNumber(field: NumericField, raw: string | number | null | undefined): void {
    this.draft.set(syncDerivedPrices({ ...this.draft(), [field]: toNumber(raw) }));
  }

  setText(field: TextField, raw: string | null | undefined): void {
    this.draft.set({ ...this.draft(), [field]: raw ?? '' });
  }

  setCuisineType(type: CuisineType): void {
    this.draft.set(syncDerivedPrices({ ...this.draft(), cuisineType: type }));
  }

  setAmenity(field: AmenityField, value: boolean): void {
    this.draft.set({ ...this.draft(), [field]: value });
  }
}

function toNumber(raw: string | number | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
