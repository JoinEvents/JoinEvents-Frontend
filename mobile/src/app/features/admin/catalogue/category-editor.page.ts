import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
  IonItem, IonInput, IonTextarea, IonToggle, IonSpinner, IonNote,
  NavController
} from '@ionic/angular/standalone';

import { AdminCatalogueService } from '../../../core/services/admin-catalogue.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoryPayload, EventCategory } from '../../../core/models/catalogue.model';
import { distinctByUse, toSlug } from '../../../core/utils/catalogue.util';
import { GradientFieldComponent } from './gradient-field.component';
import { IconFieldComponent } from './icon-field.component';
import { TagListComponent } from './tag-list.component';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton.component';

/**
 * Create or edit an event category with every field the web console has.
 * Suggestions (icons, gradients) come from the categories and tiers already
 * saved, so nothing about the catalogue is baked into the app.
 */
@Component({
  selector: 'app-admin-category-editor',
  standalone: true,
  imports: [
    GradientFieldComponent, IconFieldComponent, TagListComponent, ListSkeletonComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
    IonItem, IonInput, IonTextarea, IonToggle, IonSpinner, IonNote
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/admin/tabs/catalogue" text="" /></ion-buttons>
        <ion-title>{{ id ? 'Edit category' : 'New category' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="je-section"><app-list-skeleton [count]="4" /></div>
      } @else {
        <div class="je-section">
          <label class="flabel">Category name *</label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="name()" (ionInput)="onName($any($event.target).value)"
                       placeholder="e.g. Wedding Photography" />
          </ion-item>

          <label class="flabel">Category key *</label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="categoryKey()" (ionInput)="onKey($any($event.target).value)"
                       placeholder="wedding_photography" autocapitalize="none" autocorrect="off" />
          </ion-item>
          <ion-note class="je-xs hint">
            Lowercase letters, numbers and underscores. Vendor packages are filed under this key
            @if (id) { — changing it affects existing packages }.
          </ion-note>

          <div class="pair">
            <div>
              <label class="flabel">Hindi name</label>
              <ion-item class="je-field" lines="none">
                <ion-input [value]="nameHindi()" (ionInput)="nameHindi.set($any($event.target).value ?? '')"
                           placeholder="e.g. Shaadi" />
              </ion-item>
            </div>
            <div>
              <label class="flabel">Starting price (₹)</label>
              <ion-item class="je-field" lines="none">
                <ion-input type="number" inputmode="numeric" [value]="startingPrice()"
                           (ionInput)="startingPrice.set(toNumber($any($event.target).value))" placeholder="0" />
              </ion-item>
            </div>
          </div>

          <label class="flabel">Icon *</label>
          <app-icon-field [(value)]="icon" [suggestions]="iconSuggestions()" [gradient]="gradient()" />

          <label class="flabel">Card gradient</label>
          <app-gradient-field [(value)]="gradient" [suggestions]="gradientSuggestions()" [icon]="icon()" />

          <label class="flabel">Description</label>
          <ion-item class="je-field" lines="none">
            <ion-textarea [value]="description()" (ionInput)="description.set($any($event.target).value ?? '')"
                          [rows]="3" [autoGrow]="true" placeholder="Briefly describe what this category covers" />
          </ion-item>

          <label class="flabel">Popular services</label>
          <app-tag-list [(value)]="popularServices" placeholder="e.g. Venue, Catering — press enter" />

          <label class="flabel">CSS class <span class="je-soft">(optional)</span></label>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="colorClass()" (ionInput)="colorClass.set($any($event.target).value ?? '')"
                       placeholder="Theme class used by the web app" autocapitalize="none" />
          </ion-item>

          <ion-item class="je-field" lines="none">
            <ion-toggle [checked]="isActive()" (ionChange)="isActive.set($any($event.detail.checked))">
              <span class="je-sm je-bold">{{ isActive() ? 'Active' : 'Inactive' }}</span><br />
              <span class="je-xs je-muted">Whether vendors and customers can see this category.</span>
            </ion-toggle>
          </ion-item>

          @if (problem()) { <p class="je-error">{{ problem() }}</p> }
        </div>

        <div class="je-action-bar">
          <ion-button expand="block" class="je-btn-gradient submit" (click)="save()" [disabled]="saving()">
            @if (saving()) { <ion-spinner name="crescent" /> } @else { {{ id ? 'Save changes' : 'Create category' }} }
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .flabel { display: block; font-size: var(--je-fs-xs); font-weight: 700; color: var(--je-text-muted);
              margin: 12px 2px 6px; }
    .hint { display: block; margin: -4px 4px 4px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .submit { margin: 0; width: 100%; }
  `]
})
export class AdminCategoryEditorPage implements OnInit {
  private route = inject(ActivatedRoute);
  private nav = inject(NavController);
  private catalogue = inject(AdminCatalogueService);
  private toast = inject(ToastService);

  readonly id: string | null = this.route.snapshot.paramMap.get('id');

  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly name = signal('');
  readonly categoryKey = signal('');
  readonly nameHindi = signal('');
  readonly startingPrice = signal<number | null>(null);
  readonly icon = signal('');
  readonly gradient = signal('');
  readonly colorClass = signal('');
  readonly description = signal('');
  readonly popularServices = signal<string[]>([]);
  readonly isActive = signal(true);

  /** Once the admin types a key, the name stops overwriting it. */
  private keyTouched = false;

  readonly iconSuggestions = signal<string[]>([]);
  readonly gradientSuggestions = signal<string[]>([]);

  readonly problem = computed(() => {
    if (!this.name().trim()) return 'Enter a category name.';
    if (!/^[a-z0-9_]+$/.test(this.categoryKey())) return 'The key may only contain a-z, 0-9 and _.';
    if (!this.icon().trim()) return 'Choose an icon.';
    if ((this.startingPrice() ?? 0) < 0) return 'Starting price cannot be negative.';
    return null;
  });

  ngOnInit(): void {
    // One call gives both the record being edited and the catalogue-wide
    // suggestions; tiers add their icons and gradients to the pool.
    this.catalogue.getCategories().subscribe(categories => {
      this.catalogue.getTiers().subscribe(tiers => {
        const all = categories.data ?? [];
        const tierList = tiers.data ?? [];
        this.iconSuggestions.set(distinctByUse([...all.map(c => c.icon), ...tierList.map(t => t.icon)]));
        this.gradientSuggestions.set(distinctByUse([...all.map(c => c.gradient), ...tierList.map(t => t.gradient)]));

        if (categories.error) void this.toast.error(categories.error);
        if (this.id) {
          const record = all.find(c => String(c.id) === this.id);
          if (record) this.fill(record);
          else if (!categories.error) void this.toast.error('This category no longer exists.');
        }
        this.loading.set(false);
      });
    });
  }

  onName(value: string | null | undefined): void {
    this.name.set(value ?? '');
    // Auto-derive the key for new categories only: on an existing one the key
    // is what packages are filed under, so it changes only when edited directly.
    if (!this.id && !this.keyTouched) this.categoryKey.set(toSlug(this.name()));
  }

  onKey(value: string | null | undefined): void {
    this.keyTouched = true;
    this.categoryKey.set(toSlug(value ?? ''));
  }

  toNumber(value: string | number | null | undefined): number | null {
    return value === '' || value === null || value === undefined ? null : Number(value);
  }

  save(): void {
    const problem = this.problem();
    if (problem) {
      void this.toast.error(problem);
      return;
    }

    const payload: CategoryPayload = {
      name: this.name().trim(),
      categoryKey: this.categoryKey(),
      icon: this.icon().trim(),
      nameHindi: this.nameHindi().trim(),
      gradient: this.gradient().trim(),
      colorClass: this.colorClass().trim(),
      startingPrice: this.startingPrice() ?? 0,
      description: this.description().trim(),
      popularServices: this.popularServices(),
      isActive: this.isActive()
    };
    // Leave optional styling to the server's defaults rather than sending blanks.
    if (!payload.gradient) delete payload.gradient;
    if (!payload.colorClass) delete payload.colorClass;

    this.saving.set(true);
    const request$ = this.id
      ? this.catalogue.updateCategory(this.id, payload)
      : this.catalogue.createCategory(payload);

    request$.subscribe(result => {
      this.saving.set(false);
      if (result.error) {
        void this.toast.error(result.error);
        return;
      }
      void this.toast.success(this.id ? 'Category updated.' : 'Category created.');
      void this.nav.navigateBack(['/admin/tabs/catalogue'], { queryParams: { tab: 'categories' } });
    });
  }

  private fill(c: EventCategory): void {
    this.name.set(c.name ?? '');
    this.categoryKey.set(c.categoryKey ?? '');
    this.nameHindi.set(c.nameHindi ?? '');
    this.startingPrice.set(c.startingPrice ?? null);
    this.icon.set(c.icon ?? '');
    this.gradient.set(c.gradient ?? '');
    this.colorClass.set(c.colorClass ?? '');
    this.description.set(c.description ?? '');
    this.popularServices.set([...(c.popularServices ?? [])]);
    this.isActive.set(c.isActive !== false);
  }
}
