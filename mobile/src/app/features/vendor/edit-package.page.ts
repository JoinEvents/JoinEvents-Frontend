import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonChip, IonLabel
} from '@ionic/angular/standalone';

import { VendorPackageService } from '../../core/services/vendor-package.service';
import { PackageService } from '../../core/services/package.service';
import { ToastService } from '../../core/services/toast.service';
import { base64ToBlob, photoFileInfo, pickPhoto } from '../../core/utils/camera.util';
import { resolveMediaUrl } from '../../core/utils/media-url.util';
import { compareTiers } from '../../core/utils/catalogue.util';
import { Tier } from '../../core/models/catalogue.model';

/** The API accepts at most this many images per package upload. */
const MAX_PHOTOS = 6;

/**
 * Create or edit a package. Images are captured with the device camera or
 * picked from the roll — on a phone that is the whole point: a vendor can
 * photograph a venue and list it without touching a desktop.
 */
@Component({
  selector: 'app-vendor-edit-package',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonChip, IonLabel
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/vendor/tabs/packages" text="" />
        </ion-buttons>
        <ion-title>{{ editing() ? 'Edit package' : 'New package' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <!-- Photos ----------------------------------------------------- -->
        <div class="je-section-head"><h2>Photos</h2></div>
        <div class="photos">
          @for (photo of photos(); track photo.preview; let i = $index) {
            <div class="photo">
              <img [src]="photo.preview" alt="" />
              <button class="photo__x" (click)="removePhoto(i)" aria-label="Remove photo">
                <ion-icon name="close" />
              </button>
            </div>
          }
          @if (photos().length < maxPhotos) {
            <button class="photo photo--add" (click)="addPhoto()">
              <ion-icon name="camera-outline" />
              <span class="je-xs">Add</span>
            </button>
          }
        </div>
        <p class="je-xs je-soft hint">
          The first photo is the cover. Add up to {{ maxPhotos }} photos — packages with five or more get noticeably more enquiries.
        </p>

        <form [formGroup]="form">
          <div class="je-section-head"><h2>Details</h2></div>

          <ion-item class="je-field" lines="none">
            <ion-input formControlName="name" placeholder="Package name" />
          </ion-item>

          <ion-item class="je-field" lines="none">
            <ion-select formControlName="category" placeholder="Event category" interface="action-sheet">
              @for (category of categories(); track category.id) {
                <ion-select-option [value]="category.id">{{ category.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          @if (tierOptions().length) {
            <ion-item class="je-field" lines="none">
              <ion-select formControlName="tier" placeholder="Pricing tier" interface="action-sheet">
                @for (tier of tierOptions(); track tier.id) {
                  <ion-select-option [value]="tier.name">{{ tier.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
            @if (selectedTier()?.priceRanges?.length) {
              <div class="je-card ranges">
                <span class="je-xs je-bold">{{ selectedTier()!.name }} price ranges</span>
                @for (r of selectedTier()!.priceRanges; track r.serviceName) {
                  <div class="ranges__row je-xs">
                    <span>{{ r.serviceName }}</span><span>₹{{ r.minPrice }} – ₹{{ r.maxPrice }}</span>
                  </div>
                }
              </div>
            }
          }

          <ion-item class="je-field" lines="none">
            <ion-textarea formControlName="description" [rows]="4" [autoGrow]="true"
                          placeholder="Describe what makes this package worth booking" />
          </ion-item>

          <div class="je-section-head"><h2>Pricing &amp; capacity</h2></div>

          <ion-item class="je-field" lines="none">
            <ion-icon name="pricetag-outline" slot="start" color="medium" />
            <ion-input formControlName="price" type="number" inputmode="numeric" placeholder="Base price (₹)" />
          </ion-item>

          <div class="pair">
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="maxGuests" type="number" inputmode="numeric" placeholder="Max guests" />
            </ion-item>
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="durationHours" type="number" inputmode="numeric" placeholder="Hours" />
            </ion-item>
          </div>

          <div class="je-section-head"><h2>What's included</h2></div>
          <ion-item class="je-field" lines="none">
            <ion-input [value]="inclusionDraft()" placeholder="Add an inclusion and press enter"
                       (ionInput)="inclusionDraft.set($any($event.target).value)"
                       (keyup.enter)="addInclusion()" />
            <ion-button slot="end" fill="clear" (click)="addInclusion()">
              <ion-icon slot="icon-only" name="add" />
            </ion-button>
          </ion-item>

          @if (inclusions().length) {
            <div class="chips">
              @for (item of inclusions(); track item) {
                <ion-chip (click)="removeInclusion(item)">
                  <ion-label>{{ item }}</ion-label>
                  <ion-icon name="close-circle" />
                </ion-chip>
              }
            </div>
          }

          <div class="je-section-head"><h2>Location</h2></div>
          <ion-item class="je-field" lines="none">
            <ion-icon name="location-outline" slot="start" color="medium" />
            <ion-input formControlName="city" placeholder="City" />
          </ion-item>
          <ion-item class="je-field" lines="none">
            <ion-icon name="pin-outline" slot="start" color="medium" />
            <ion-input formControlName="locality" placeholder="Locality / area" />
          </ion-item>
        </form>
      </div>

      <div class="je-action-bar">
        <ion-button expand="block" class="je-btn-gradient submit" (click)="save()" [disabled]="saving()">
          @if (saving()) { <ion-spinner name="crescent" /> }
          @else { {{ editing() ? 'Save changes' : 'Publish package' }} }
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .photo { position: relative; aspect-ratio: 1; border-radius: var(--je-radius-sm); overflow: hidden; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .photo__x { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px;
                border: none; border-radius: 50%; background: rgba(0,0,0,0.6);
                color: #fff; display: grid; place-items: center; }
    .photo__x ion-icon { font-size: 13px; }
    .photo--add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
                  background: var(--je-bg-light); border: 1px dashed var(--je-border-color);
                  color: var(--je-text-muted); }
    .photo--add ion-icon { font-size: 22px; }
    .hint { margin: 10px 0 4px; line-height: 1.5; }
    .pair { display: flex; gap: 10px; }
    .pair ion-item { flex: 1; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    ion-chip { --background: var(--je-bg-light); --color: var(--je-text-main); margin: 0;
               font-size: var(--je-fs-xs); font-weight: 600; }
    .submit { margin: 0; width: 100%; }
    .ranges { padding: 10px 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; }
    .ranges__row { display: flex; justify-content: space-between; gap: 10px; color: var(--je-text-muted); }
  `]
})
export class VendorEditPackagePage implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private vendorPackages = inject(VendorPackageService);
  private packageService = inject(PackageService);
  private toast = inject(ToastService);

  readonly saving = signal(false);
  readonly editing = signal(false);
  readonly categories = signal<{ id: string; uuid?: string; name: string }[]>([]);
  /** Active tiers from the admin catalogue; filtered to the chosen category below. */
  readonly tiers = signal<Tier[]>([]);
  readonly inclusions = signal<string[]>([]);
  readonly inclusionDraft = signal('');
  readonly photos = signal<{ preview: string; blob?: Blob; hostedUrl?: string; name: string }[]>([]);

  readonly maxPhotos = MAX_PHOTOS;
  private packageId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    category: ['', Validators.required],
    // The admin-defined tier name; required only when the category has tiers.
    tier: [''],
    description: ['', [Validators.required, Validators.minLength(20)]],
    price: [0, [Validators.required, Validators.min(1)]],
    maxGuests: [100, [Validators.required, Validators.min(1)]],
    durationHours: [6, [Validators.required, Validators.min(1)]],
    city: ['', Validators.required],
    locality: ['']
  });

  private readonly categoryValue = toSignal(this.form.controls.category.valueChanges, {
    initialValue: this.form.controls.category.value
  });
  private readonly tierValue = toSignal(this.form.controls.tier.valueChanges, {
    initialValue: this.form.controls.tier.value
  });

  /** Tiers belong to a category by its record id; the form holds the category key. */
  readonly tierOptions = computed(() => {
    const category = this.categories().find(c => c.id === this.categoryValue());
    if (!category) return [];
    return this.tiers()
      .filter(t => String(t.categoryId) === category.uuid || String(t.categoryId) === category.id)
      .sort(compareTiers);
  });

  readonly selectedTier = computed(() => this.tierOptions().find(t => t.name === this.tierValue()) ?? null);

  constructor() {
    // A tier from another category is not valid for this one.
    effect(() => {
      const options = this.tierOptions();
      const current = this.form.controls.tier.value;
      if (current && this.tiers().length && !options.some(t => t.name === current)) {
        this.form.controls.tier.setValue('');
      }
    });
  }

  ngOnInit(): void {
    this.packageService.getEventTypes().subscribe(types =>
      this.categories.set(types.map(t => ({ id: t.id, uuid: t.uuid, name: t.name })))
    );
    this.packageService.getTiers().subscribe(tiers => this.tiers.set(tiers));

    this.packageId = this.route.snapshot.paramMap.get('id');
    if (!this.packageId) return;

    this.editing.set(true);
    this.vendorPackages.getById(this.packageId).subscribe(pkg => {
      if (!pkg) return;
      this.form.patchValue({
        name: String(pkg['name'] ?? ''),
        category: String(pkg['category'] ?? pkg['categoryKey'] ?? ''),
        tier: String(pkg['theme'] ?? pkg['tier'] ?? ''),
        description: String(pkg['description'] ?? ''),
        price: Number((pkg['pricing'] as Record<string, unknown>)?.['basePrice'] ?? pkg['price'] ?? 0),
        maxGuests: Number((pkg['capacity'] as Record<string, unknown>)?.['maxGuests'] ?? pkg['maxGuests'] ?? 100),
        durationHours: Number(pkg['durationHours'] ?? 6),
        city: String((pkg['address'] as Record<string, unknown>)?.['city'] ?? ''),
        locality: String((pkg['address'] as Record<string, unknown>)?.['locality'] ?? '')
      });
      this.inclusions.set((pkg['includes'] as string[]) ?? (pkg['services'] as string[]) ?? []);
      // Existing images are already hosted: kept by URL, nothing to re-upload.
      this.photos.set(((pkg['images'] as string[]) ?? []).map(url => ({
        preview: resolveMediaUrl(url) ?? url, hostedUrl: url, name: 'existing'
      })));
    });
  }

  addInclusion(): void {
    const value = this.inclusionDraft().trim();
    if (!value || this.inclusions().includes(value)) return;
    this.inclusions.update(list => [...list, value]);
    this.inclusionDraft.set('');
  }

  removeInclusion(item: string): void {
    this.inclusions.update(list => list.filter(i => i !== item));
  }

  async addPhoto(): Promise<void> {
    if (this.photos().length >= MAX_PHOTOS) return;
    try {
      const photo = await pickPhoto({
        quality: 80,
        width: 1600,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Package photo',
        promptLabelPhoto: 'Choose from gallery',
        promptLabelPicture: 'Take a photo'
      });
      if (!photo?.base64String) return;

      const { mime, ext } = photoFileInfo(photo.format);
      const blob = base64ToBlob(photo.base64String, mime);
      this.photos.update(list => [
        ...list,
        { preview: `data:${mime};base64,${photo.base64String}`, blob, name: `photo-${Date.now()}.${ext}` }
      ]);
    } catch (error) {
      void this.toast.error((error as Error).message);
    }
  }

  removePhoto(index: number): void {
    this.photos.update(list => list.filter((_, i) => i !== index));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.toast.error('Complete every field before publishing.');
      return;
    }
    if (this.tierOptions().length && !this.form.controls.tier.value) {
      void this.toast.error('Choose a pricing tier for this category.');
      return;
    }
    if (!this.inclusions().length) {
      void this.toast.error('Add at least one inclusion so customers know what they get.');
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    // Shaped like the API's CreatePackageRequest: price and guest count are
    // nested, and inclusions are "includes" — flat fields were silently dropped.
    const payload: Record<string, unknown> = {
      name: value.name,
      category: value.category,
      description: value.description,
      includes: this.inclusions(),
      address: { city: value.city, locality: value.locality },
      pricing: { basePrice: Number(value.price) },
      capacity: { maxGuests: Number(value.maxGuests) },
      // The API files a package's tier under "theme", as the web app does.
      theme: value.tier,
      durationHours: Number(value.durationHours)
    };

    const editingId = this.packageId;
    if (editingId) {
      // Update replaces the image list, so send the hosted photos being kept —
      // omitting it would delete every existing photo.
      payload['images'] = this.photos().filter(p => p.hostedUrl).map(p => p.hostedUrl!);
    }

    const save$ = editingId
      ? this.vendorPackages.update(editingId, payload)
      : this.vendorPackages.create(payload);

    save$.subscribe(result => {
      if (result.error || !result.id) {
        this.saving.set(false);
        void this.toast.error(result.error ?? 'Could not save the package. Please try again.');
        return;
      }
      this.uploadNewPhotos(result.id, editingId ? 'Package updated.' : 'Package submitted — it goes live once verified.');
    });
  }

  /**
   * Only photos captured in this session carry a blob; the rest are already
   * hosted. Waits for the upload so a failure is reported instead of lost
   * behind the navigation.
   */
  private uploadNewPhotos(packageId: string, successMessage: string): void {
    const fresh = this.photos()
      .filter(photo => photo.blob)
      .map(photo => ({ blob: photo.blob!, name: photo.name }));

    const done = (warning?: string) => {
      this.saving.set(false);
      if (warning) void this.toast.error(warning);
      else void this.toast.success(successMessage);
      void this.router.navigate(['/vendor/tabs/packages'], { replaceUrl: true });
    };

    if (!fresh.length) {
      done();
      return;
    }
    this.vendorPackages.uploadImages(packageId, fresh).subscribe(result =>
      done(result.error ? `Package saved, but the photos were not uploaded: ${result.error}` : undefined)
    );
  }
}
