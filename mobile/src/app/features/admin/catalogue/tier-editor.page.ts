import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonToggle, IonSpinner, IonSelect, IonSelectOption, IonChip, IonLabel,
  NavController
} from '@ionic/angular/standalone';

import { AdminCatalogueService } from '../../../core/services/admin-catalogue.service';
import { ToastService } from '../../../core/services/toast.service';
import { EventCategory, Tier, TierPayload, TierPriceRange } from '../../../core/models/catalogue.model';
import { distinctByUse } from '../../../core/utils/catalogue.util';
import { GradientFieldComponent } from './gradient-field.component';
import { IconFieldComponent } from './icon-field.component';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton.component';

/**
 * Create or edit a pricing tier: its category, the price range allowed for
 * each service, and how it is presented. Service rows are seeded from the
 * chosen category's popular services, as on the web console.
 */
@Component({
  selector: 'app-admin-tier-editor',
  standalone: true,
  imports: [
    GradientFieldComponent, IconFieldComponent, ListSkeletonComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonInput, IonTextarea, IonToggle, IonSpinner, IonSelect, IonSelectOption, IonChip, IonLabel
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/admin/tabs/catalogue" text="" /></ion-buttons>
        <ion-title>{{ id ? 'Edit tier' : 'New tier' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="je-section"><app-list-skeleton [count]="4" /></div>
      } @else {
        <div class="je-section">
          <label class="flabel">Tier name *</label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="name()" (ionInput)="name.set($any($event.target).value ?? '')"
                       placeholder="e.g. Gold" />
          </ion-item>

          <label class="flabel">Event category *</label>
          <ion-item class="je-field" lines="none">
            <ion-select [value]="categoryId()" placeholder="Choose a category" interface="action-sheet"
                        (ionChange)="onCategory($any($event.detail.value))">
              @for (c of categoryOptions(); track c.id) {
                <ion-select-option [value]="c.id">
                  {{ c.name }}{{ c.isActive === false ? ' (inactive)' : '' }}
                </ion-select-option>
              }
            </ion-select>
          </ion-item>

          <label class="flabel">Description</label>
          <ion-item class="je-field" lines="none">
            <ion-textarea [value]="description()" (ionInput)="description.set($any($event.target).value ?? '')"
                          [rows]="3" [autoGrow]="true" placeholder="What sets this tier apart" />
          </ion-item>

          <label class="flabel">Icon</label>
          <app-icon-field [(value)]="icon" [suggestions]="iconSuggestions()" [gradient]="gradient()" />

          <label class="flabel">Card gradient</label>
          <app-gradient-field [(value)]="gradient" [suggestions]="gradientSuggestions()" [icon]="icon()" />

          <div class="je-section-head ranges-head">
            <h2>Service price ranges</h2>
            <ion-button size="small" fill="clear" (click)="addRange('')">
              <ion-icon slot="start" name="add" /> Row
            </ion-button>
          </div>
          <p class="je-xs je-soft">Vendors' prices for each service must fall inside its range.</p>

          @if (missingServices().length) {
            <div class="chips">
              @for (svc of missingServices(); track svc) {
                <ion-chip (click)="addRange(svc)">
                  <ion-icon name="add-circle" /><ion-label>{{ svc }}</ion-label>
                </ion-chip>
              }
            </div>
          }

          @for (range of ranges(); track $index; let i = $index) {
            <div class="je-card range">
              <div class="range__top">
                <ion-item class="je-field grow" lines="none">
                  <ion-input [value]="range.serviceName" placeholder="Service name"
                             (ionInput)="patchRange(i, 'serviceName', $any($event.target).value)" />
                </ion-item>
                <ion-button fill="clear" color="danger" (click)="removeRange(i)" aria-label="Remove row">
                  <ion-icon slot="icon-only" name="trash-outline" />
                </ion-button>
              </div>
              <div class="pair">
                <ion-item class="je-field" lines="none">
                  <ion-input type="number" inputmode="numeric" [value]="range.minPrice" label="Min ₹"
                             labelPlacement="stacked"
                             (ionInput)="patchRange(i, 'minPrice', $any($event.target).value)" />
                </ion-item>
                <ion-item class="je-field" lines="none">
                  <ion-input type="number" inputmode="numeric" [value]="range.maxPrice" label="Max ₹"
                             labelPlacement="stacked"
                             (ionInput)="patchRange(i, 'maxPrice', $any($event.target).value)" />
                </ion-item>
              </div>
            </div>
          } @empty {
            <p class="je-xs je-muted empty">No services yet — pick a category or add a row.</p>
          }

          <ion-item class="je-field" lines="none">
            <ion-toggle [checked]="isActive()" (ionChange)="isActive.set($any($event.detail.checked))">
              <span class="je-sm je-bold">{{ isActive() ? 'Active' : 'Inactive' }}</span><br />
              <span class="je-xs je-muted">Whether vendors can list packages in this tier.</span>
            </ion-toggle>
          </ion-item>

          @if (problem()) { <p class="je-error">{{ problem() }}</p> }
        </div>

        <div class="je-action-bar">
          <ion-button expand="block" class="je-btn-gradient submit" (click)="save()" [disabled]="saving()">
            @if (saving()) { <ion-spinner name="crescent" /> } @else { {{ id ? 'Save changes' : 'Create tier' }} }
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .flabel { display: block; font-size: var(--je-fs-xs); font-weight: 700; color: var(--je-text-muted);
              margin: 12px 2px 6px; }
    .ranges-head { margin-top: 16px; display: flex; align-items: center; justify-content: space-between; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    ion-chip { margin: 0; --background: var(--je-bg-light); --color: var(--je-text-main);
               font-size: var(--je-fs-xs); font-weight: 600; }
    .range { padding: 10px; margin-bottom: 8px; }
    .range__top { display: flex; align-items: center; gap: 4px; }
    .grow { flex: 1; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .empty { margin: 8px 2px 12px; }
    .submit { margin: 0; width: 100%; }
  `]
})
export class AdminTierEditorPage implements OnInit {
  private route = inject(ActivatedRoute);
  private nav = inject(NavController);
  private catalogue = inject(AdminCatalogueService);
  private toast = inject(ToastService);

  readonly id: string | null = this.route.snapshot.paramMap.get('id');

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly categories = signal<EventCategory[]>([]);

  readonly name = signal('');
  readonly categoryId = signal('');
  readonly description = signal('');
  readonly icon = signal('');
  readonly gradient = signal('');
  readonly ranges = signal<TierPriceRange[]>([]);
  readonly isActive = signal(true);

  readonly iconSuggestions = signal<string[]>([]);
  readonly gradientSuggestions = signal<string[]>([]);

  /** Active categories, plus the tier's own even if it has since been deactivated. */
  readonly categoryOptions = computed(() =>
    this.categories().filter(c => c.isActive !== false || String(c.id) === this.categoryId())
  );

  private readonly selectedCategory = computed(() =>
    this.categories().find(c => String(c.id) === this.categoryId()) ?? null
  );

  /** The chosen category's popular services not yet priced in this tier. */
  readonly missingServices = computed(() => {
    const priced = new Set(this.ranges().map(r => r.serviceName.trim().toLowerCase()));
    return (this.selectedCategory()?.popularServices ?? []).filter(s => !priced.has(s.trim().toLowerCase()));
  });

  readonly problem = computed(() => {
    if (!this.name().trim()) return 'Enter a tier name.';
    if (!this.categoryId()) return 'Choose the category this tier belongs to.';
    for (const r of this.ranges()) {
      if (!r.serviceName.trim()) continue; // blank rows are dropped on save
      if (r.minPrice < 0 || r.maxPrice < 0) return `Prices for ${r.serviceName} cannot be negative.`;
      if (r.maxPrice && r.minPrice > r.maxPrice) return `Min price for ${r.serviceName} is above its max.`;
    }
    return null;
  });

  ngOnInit(): void {
    this.catalogue.getCategories().subscribe(categories => {
      this.catalogue.getTiers().subscribe(tiers => {
        const catList = categories.data ?? [];
        const tierList = tiers.data ?? [];
        this.categories.set(catList);
        this.iconSuggestions.set(distinctByUse([...tierList.map(t => t.icon), ...catList.map(c => c.icon)]));
        this.gradientSuggestions.set(distinctByUse([...tierList.map(t => t.gradient), ...catList.map(c => c.gradient)]));

        const error = categories.error ?? tiers.error;
        if (error) void this.toast.error(error);
        if (this.id) {
          const record = tierList.find(t => String(t.id) === this.id);
          if (record) this.fill(record);
          else if (!tiers.error) void this.toast.error('This tier no longer exists.');
        }
        this.loading.set(false);
      });
    });
  }

  /**
   * Switching category seeds the rows from its popular services, but only when
   * no prices have been entered yet — typed-in prices are never thrown away.
   */
  onCategory(categoryId: string): void {
    this.categoryId.set(String(categoryId ?? ''));
    const hasPrices = this.ranges().some(r => r.serviceName.trim() && (r.minPrice || r.maxPrice));
    if (hasPrices) return;
    this.ranges.set((this.selectedCategory()?.popularServices ?? []).map(serviceName => ({
      serviceName, minPrice: 0, maxPrice: 0
    })));
  }

  addRange(serviceName: string): void {
    this.ranges.update(list => [...list, { serviceName, minPrice: 0, maxPrice: 0 }]);
  }

  removeRange(index: number): void {
    this.ranges.update(list => list.filter((_, i) => i !== index));
  }

  patchRange(index: number, field: keyof TierPriceRange, raw: string | number | null | undefined): void {
    this.ranges.update(list => list.map((r, i) => {
      if (i !== index) return r;
      return field === 'serviceName'
        ? { ...r, serviceName: String(raw ?? '') }
        : { ...r, [field]: raw === '' || raw === null || raw === undefined ? 0 : Number(raw) };
    }));
  }

  save(): void {
    const problem = this.problem();
    if (problem) {
      void this.toast.error(problem);
      return;
    }

    const payload: TierPayload = {
      name: this.name().trim(),
      categoryId: this.categoryId(),
      description: this.description().trim(),
      isActive: this.isActive(),
      icon: this.icon().trim(),
      gradient: this.gradient().trim(),
      priceRanges: this.ranges()
        .filter(r => r.serviceName.trim())
        .map(r => ({ serviceName: r.serviceName.trim(), minPrice: r.minPrice, maxPrice: r.maxPrice }))
    };
    // Leave styling to the server's defaults rather than sending blanks.
    if (!payload.icon) delete payload.icon;
    if (!payload.gradient) delete payload.gradient;

    this.saving.set(true);
    const request$ = this.id
      ? this.catalogue.updateTier(this.id, payload)
      : this.catalogue.createTier(payload);

    request$.subscribe(result => {
      this.saving.set(false);
      if (result.error) {
        void this.toast.error(result.error);
        return;
      }
      void this.toast.success(this.id ? 'Tier updated.' : 'Tier created.');
      void this.nav.navigateBack(['/admin/tabs/catalogue'], { queryParams: { tab: 'tiers' } });
    });
  }

  private fill(t: Tier): void {
    this.name.set(t.name ?? '');
    this.categoryId.set(String(t.categoryId ?? ''));
    this.description.set(t.description ?? '');
    this.icon.set(t.icon ?? '');
    this.gradient.set(t.gradient ?? '');
    this.ranges.set((t.priceRanges ?? []).map(r => ({ ...r })));
    this.isActive.set(t.isActive !== false);
  }
}
