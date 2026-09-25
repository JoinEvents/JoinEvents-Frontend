import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonChip, IonLabel, IonNote,
  IonFooter, NavController
} from '@ionic/angular/standalone';

import { VendorPackageService } from '../../../core/services/vendor-package.service';
import { PackageService } from '../../../core/services/package.service';
import { ProfileService } from '../../../core/services/profile.service';
import { VendorService } from '../../../core/services/vendor.service';
import { GeocodingService, PlaceSuggestion } from '../../../core/services/geocoding.service';
import { ToastService } from '../../../core/services/toast.service';
import { EventType } from '../../../core/models/event.model';
import { Tier } from '../../../core/models/catalogue.model';
import { VendorBusinessProfile } from '../../../core/models/user.model';
import { compareTiers } from '../../../core/utils/catalogue.util';
import { VendorReadiness, vendorReadiness } from '../../../core/utils/vendor-readiness.util';
import {
  DraftProblem, MAX_PORTFOLIO_PHOTOS, PackageAddress, PackageDraft, draftFromPackage, draftToPayload,
  emptyDay, emptyDraft, inclusionKind, validateBasics, validateDayPlan, validateDraft, validateServices, withIncludes
} from '../../../core/utils/package-draft.util';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton.component';
import { ServiceDetailComponent } from './service-detail.component';
import { PhotoGridComponent } from './photo-grid.component';

/**
 * Create or edit a vendor package with everything the web console's
 * add-service form captures: details and address, tier and per-service
 * details, a day-wise plan, and portfolio photos. Categories, tiers and each
 * category's services all come from the admin catalogue.
 */
@Component({
  selector: 'app-vendor-package-editor',
  standalone: true,
  imports: [
    RouterLink, ListSkeletonComponent, ServiceDetailComponent, PhotoGridComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonChip, IonLabel, IonNote, IonFooter
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/vendor/tabs/packages" text="" /></ion-buttons>
        <ion-title>{{ id ? 'Edit package' : 'New package' }}</ion-title>
      </ion-toolbar>
      @if (!loading() && !blocked()) {
        <ion-toolbar class="steps-bar">
          <div class="steps">
            @for (s of steps; track s.n) {
              <button type="button" class="step" [class.step--on]="step() === s.n" [class.step--done]="step() > s.n"
                      [disabled]="s.n > step()" (click)="goTo(s.n)">
                <span class="step__n">{{ step() > s.n ? '✓' : s.n }}</span>
                <span class="step__label">{{ s.label }}</span>
              </button>
            }
          </div>
        </ion-toolbar>
      }
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="je-section"><app-list-skeleton [count]="5" /></div>
      } @else if (blocked()) {
        <!-- Readiness gate: the API refuses packages until both are done. -->
        <div class="je-section gate">
          <ion-icon name="shield-checkmark-outline" class="gate__icon" />
          <h2>Finish setting up your account</h2>
          <p class="je-sm je-muted">Packages can be published once these are done:</p>

          <div class="je-card gate__row" [class.gate__row--ok]="readiness()!.profileComplete">
            <ion-icon [name]="readiness()!.profileComplete ? 'checkmark-circle' : 'alert-circle'" />
            <div class="grow">
              <strong class="je-sm">Business profile</strong>
              <span class="je-xs je-muted">
                {{ readiness()!.profileComplete ? 'Complete' : 'Missing: ' + readiness()!.profileGaps.join(', ').toLowerCase() }}
              </span>
            </div>
            @if (!readiness()!.profileComplete) {
              <ion-button size="small" routerLink="/vendor/profile">Complete</ion-button>
            }
          </div>

          <div class="je-card gate__row" [class.gate__row--ok]="readiness()!.kycVerified">
            <ion-icon [name]="readiness()!.kycVerified ? 'checkmark-circle' : 'alert-circle'" />
            <div class="grow">
              <strong class="je-sm">KYC verification</strong>
              <span class="je-xs je-muted">{{ readiness()!.kycVerified ? 'Verified' : kycMessage() }}</span>
            </div>
            @if (!readiness()!.kycVerified) {
              <ion-button size="small" routerLink="/vendor/verification">Open</ion-button>
            }
          </div>

          <ion-button fill="clear" (click)="checkReadiness()">
            <ion-icon slot="start" name="refresh" /> Check again
          </ion-button>
        </div>
      } @else {
        <div class="je-section">
          @switch (step()) {
            @case (1) {
              <label class="flabel">Business / venue name *</label>
              <ion-item class="je-field" lines="none">
                <ion-input [value]="draft().name" placeholder="e.g. Royal Banquet Hall"
                           (ionInput)="patch({ name: $any($event.target).value ?? '' })" />
              </ion-item>

              <label class="flabel">Event category *</label>
              <ion-item class="je-field" lines="none">
                <ion-select [value]="draft().category" placeholder="Choose a category" interface="action-sheet"
                            (ionChange)="changeCategory($any($event.detail.value))">
                  @for (c of categoryOptions(); track c.id) {
                    <ion-select-option [value]="c.id">{{ c.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <label class="flabel">Experience (years)</label>
              <ion-item class="je-field" lines="none">
                <ion-input type="number" inputmode="numeric" placeholder="e.g. 5"
                           [value]="draft().experience" (ionInput)="setExperience($any($event.target).value)" />
              </ion-item>

              <label class="flabel">About your service *</label>
              <ion-item class="je-field" lines="none">
                <ion-textarea [value]="draft().description" [rows]="4" [autoGrow]="true"
                              placeholder="Tell customers why they should choose you"
                              (ionInput)="patch({ description: $any($event.target).value ?? '' })" />
              </ion-item>

              <div class="je-section-head sub"><h2>Location</h2></div>
              <ion-item class="je-field" lines="none">
                <ion-icon name="search" slot="start" color="medium" />
                <ion-input [value]="placeQuery()" placeholder="Search your address"
                           (ionInput)="searchPlace($any($event.target).value ?? '')" />
              </ion-item>
              @if (suggestions().length) {
                <div class="je-card je-card--flush suggestions">
                  @for (s of suggestions(); track $index) {
                    <button type="button" class="suggestion je-xs" (click)="applyPlace(s)">{{ s.label }}</button>
                  }
                </div>
              }
              <ion-button fill="clear" size="small" (click)="useCurrentLocation()" [disabled]="locating()">
                @if (locating()) { <ion-spinner name="crescent" slot="start" /> } @else { <ion-icon slot="start" name="locate" /> }
                Use my current location
              </ion-button>
              <ion-note class="je-xs hint">Search or locate to fill the fields below, then check them.</ion-note>

              @for (f of addressFields; track f.key) {
                <ion-item class="je-field" lines="none">
                  <ion-input [attr.name]="f.key" [label]="f.label + (f.required ? ' *' : '')" labelPlacement="stacked"
                             [value]="draft().address[f.key]" [inputmode]="f.key === 'pincode' ? 'numeric' : 'text'"
                             (ionInput)="setAddress(f.key, $any($event.target).value)" />
                </ion-item>
              }
            }

            @case (2) {
              <div class="je-section-head sub"><h2>Service tier {{ tiersAvailable() ? '*' : '' }}</h2></div>
              @if (tiersAvailable()) {
                @for (t of tierOptions(); track t.id) {
                  <button type="button" class="je-card tier" [class.tier--on]="draft().tier === t.name"
                          [style.--tier-grad]="t.gradient || 'var(--je-gradient-primary)'" (click)="patch({ tier: t.name })">
                    <span class="tier__icon"><i class="bi {{ t.icon }}"></i></span>
                    <span class="grow">
                      <strong class="je-sm">{{ t.name }}</strong>
                      @if (t.description) { <span class="je-xs je-muted">{{ t.description }}</span> }
                      @for (r of t.priceRanges; track r.serviceName) {
                        <span class="je-xs tier__range">{{ r.serviceName }}: ₹{{ r.minPrice.toLocaleString('en-IN') }} – ₹{{ r.maxPrice.toLocaleString('en-IN') }}</span>
                      }
                    </span>
                    <ion-icon [name]="draft().tier === t.name ? 'radio-button-on' : 'radio-button-off'" />
                  </button>
                }
              } @else {
                <p class="je-xs je-muted">No tiers are set up for this category yet — you can continue without one.</p>
              }

              <div class="je-section-head sub">
                <h2>Services *</h2>
                @if (availableServices().length > 1) {
                  <ion-button size="small" fill="clear" (click)="selectAllServices()">Select all</ion-button>
                }
              </div>
              @if (!availableServices().length) {
                <p class="je-xs je-muted">This category has no services configured yet. Ask the JoinEvents team to add them.</p>
              }
              <div class="chips">
                @for (s of availableServices(); track s) {
                  <ion-chip [outline]="!draft().includes.includes(s)" (click)="toggleService(s)">
                    @if (draft().includes.includes(s)) { <ion-icon name="checkmark" /> }
                    <ion-label>{{ s }}</ion-label>
                  </ion-chip>
                }
              </div>

              @for (name of draft().includes; track name) {
                <app-service-detail [name]="name" [(draft)]="draft" [tier]="selectedTier()"
                                    [expanded]="openService() === name" (toggle)="toggleOpen(name)"
                                    [problem]="problem()?.service === name ? problem()!.message : null"
                                    (busy)="trackUpload($event)" />
              }
            }

            @case (3) {
              <div class="je-section-head sub"><h2>Day-wise plan *</h2></div>
              <p class="je-xs je-muted">Walk customers through what happens, day by day.</p>
              @for (day of draft().dayPlan; track $index; let i = $index) {
                <div class="je-card day">
                  <div class="day__head">
                    <strong class="je-sm">Day {{ i + 1 }}</strong>
                    @if (draft().dayPlan.length > 1) {
                      <ion-button size="small" fill="clear" color="danger" (click)="removeDay(i)" aria-label="Remove day">
                        <ion-icon slot="icon-only" name="trash-outline" />
                      </ion-button>
                    }
                  </div>
                  <ion-item class="je-field" lines="none">
                    <ion-input [value]="day.title" placeholder="Title, e.g. Welcome ceremony & sangeet"
                               (ionInput)="setDay(i, 'title', $any($event.target).value)" />
                  </ion-item>
                  <ion-item class="je-field" lines="none">
                    <ion-textarea [value]="day.details" [rows]="3" [autoGrow]="true"
                                  placeholder="What will you do on this day?"
                                  (ionInput)="setDay(i, 'details', $any($event.target).value)" />
                  </ion-item>
                </div>
              }
              <ion-button fill="outline" expand="block" (click)="addDay()">
                <ion-icon slot="start" name="add" /> Add a day
              </ion-button>
            }

            @case (4) {
              <div class="je-section-head sub"><h2>Portfolio photos</h2></div>
              <p class="je-xs je-muted">Shown at the top of your package. The first one is the cover.</p>
              <app-photo-grid [photos]="draft().photos" (photosChange)="patch({ photos: $event })"
                              [max]="maxPortfolio" coverLabel="Cover" (busy)="trackUpload($event)" />

              <div class="je-section-head sub"><h2>Review</h2></div>
              <div class="je-card review">
                <div class="review__row"><span>Name</span><strong>{{ draft().name }}</strong></div>
                <div class="review__row"><span>Category</span><strong>{{ categoryName() }}</strong></div>
                @if (draft().tier) { <div class="review__row"><span>Tier</span><strong>{{ draft().tier }}</strong></div> }
                <div class="review__row"><span>Location</span><strong>{{ addressLine() }}</strong></div>
                @for (name of draft().includes; track name) {
                  <div class="review__row"><span>{{ name }}</span><strong>{{ servicePrice(name) }}</strong></div>
                }
                <div class="review__row"><span>Day plan</span><strong>{{ draft().dayPlan.length }} day{{ draft().dayPlan.length === 1 ? '' : 's' }}</strong></div>
              </div>
              <p class="je-xs je-soft">
                {{ id ? 'Changes' : 'New packages' }} are reviewed by the JoinEvents team before they go live.
              </p>
            }
          }

          @if (problem() && !problem()!.service) { <p class="je-error">{{ problem()!.message }}</p> }
        </div>

      }
    </ion-content>

    @if (!loading() && !blocked()) {
      <ion-footer class="ion-no-border">
        <div class="je-action-bar">
          @if (step() > 1) {
            <ion-button fill="outline" (click)="goTo(step() - 1)">Back</ion-button>
          }
          @if (step() < 4) {
            <ion-button class="je-btn-gradient grow" (click)="next()" [disabled]="uploads() > 0">
              {{ uploads() > 0 ? 'Uploading…' : 'Next' }}
            </ion-button>
          } @else {
            <ion-button class="je-btn-gradient grow" (click)="submit()" [disabled]="saving() || uploads() > 0">
              @if (saving()) { <ion-spinner name="crescent" /> }
              @else { {{ uploads() > 0 ? 'Uploading…' : (id ? 'Save changes' : 'Submit for review') }} }
            </ion-button>
          }
        </div>
      </ion-footer>
    }
  `,
  styles: [`
    .steps-bar { --min-height: 44px; }
    .steps { display: flex; justify-content: space-between; padding: 0 10px 6px; gap: 4px; }
    .step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: none;
            border: none; color: var(--je-text-soft); font-size: 10px; font-weight: 600; }
    .step__n { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
               background: var(--je-bg-light); font-size: 12px; }
    .step--on { color: var(--je-primary); }
    .step--on .step__n { background: var(--je-primary); color: #fff; }
    .step--done .step__n { background: var(--je-success); color: #fff; }
    .flabel { display: block; font-size: var(--je-fs-xs); font-weight: 700; color: var(--je-text-muted); margin: 12px 2px 6px; }
    .sub { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; }
    .hint { display: block; margin: 0 4px 8px; }
    .suggestions { margin: -4px 0 6px; }
    .suggestion { display: block; width: 100%; text-align: left; padding: 10px 12px; background: none; border: none;
                  border-bottom: 1px solid var(--je-border-color); color: var(--je-text-main); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    ion-chip { margin: 0; font-weight: 600; font-size: var(--je-fs-xs); }
    .tier { width: 100%; display: flex; align-items: flex-start; gap: 12px; text-align: left; margin-bottom: 8px;
            border: 2px solid transparent; color: var(--je-text-main); }
    .tier--on { border-color: var(--je-primary); }
    .tier__icon { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center;
                  background: var(--tier-grad); color: #fff; font-size: 18px; }
    .tier__range { display: block; color: var(--je-text-muted); }
    .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .day { padding: 10px 12px; margin-bottom: 10px; }
    .day__head { display: flex; align-items: center; justify-content: space-between; }
    .review { display: flex; flex-direction: column; gap: 8px; }
    .review__row { display: flex; justify-content: space-between; gap: 12px; font-size: var(--je-fs-sm); }
    .review__row span { color: var(--je-text-muted); }
    .review__row strong { text-align: right; }
    .gate { text-align: center; }
    .gate__icon { font-size: 48px; color: var(--je-primary); margin-top: 12px; }
    .gate__row { display: flex; align-items: center; gap: 12px; text-align: left; margin-top: 10px; }
    .gate__row > ion-icon { font-size: 24px; color: var(--je-warning); flex-shrink: 0; }
    .gate__row--ok > ion-icon { color: var(--je-success); }
    .je-action-bar ion-button.grow { flex: 1; }
  `]
})
export class VendorPackageEditorPage implements OnInit {
  private route = inject(ActivatedRoute);
  private nav = inject(NavController);
  private vendorPackages = inject(VendorPackageService);
  private packageService = inject(PackageService);
  private profileService = inject(ProfileService);
  private vendorService = inject(VendorService);
  private geocoding = inject(GeocodingService);
  private toast = inject(ToastService);

  readonly id: string | null = this.route.snapshot.paramMap.get('id');
  readonly maxPortfolio = MAX_PORTFOLIO_PHOTOS;
  readonly steps = [
    { n: 1, label: 'Details' }, { n: 2, label: 'Services' }, { n: 3, label: 'Day plan' }, { n: 4, label: 'Photos' }
  ];
  /** Field labels for the address; the values come from the vendor or the lookup. */
  readonly addressFields: { key: keyof PackageAddress; label: string; required: boolean }[] = [
    { key: 'street', label: 'Street / area', required: true },
    { key: 'locality', label: 'Locality', required: true },
    { key: 'landmark', label: 'Landmark', required: false },
    { key: 'city', label: 'City', required: true },
    { key: 'state', label: 'State', required: true },
    { key: 'pincode', label: 'Pincode', required: true },
    { key: 'country', label: 'Country', required: true }
  ];

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly step = signal(1);
  readonly draft = signal<PackageDraft>(emptyDraft());
  readonly problem = signal<DraftProblem | null>(null);
  readonly openService = signal<string | null>(null);
  readonly uploads = signal(0);

  readonly categories = signal<EventType[]>([]);
  readonly tiers = signal<Tier[]>([]);
  readonly readiness = signal<VendorReadiness | null>(null);
  readonly kycStatus = signal('');

  readonly placeQuery = signal('');
  readonly suggestions = signal<PlaceSuggestion[]>([]);
  readonly locating = signal(false);
  private readonly placeSearch$ = new Subject<string>();

  /** New packages need a ready account; edits of existing ones are allowed regardless. */
  readonly blocked = computed(() => {
    const r = this.readiness();
    return !this.id && !!r && (!r.kycVerified || !r.profileComplete);
  });

  readonly selectedCategory = computed(() => this.categories().find(c => c.id === this.draft().category) ?? null);
  readonly categoryName = computed(() => this.selectedCategory()?.name ?? this.draft().category);

  /** Categories offered: the active ones, plus the package's own if it has since been deactivated. */
  readonly categoryOptions = computed(() => {
    const list = this.categories();
    const current = this.draft().category;
    return current && !list.some(c => c.id === current) ? [...list, { id: current, name: current } as EventType] : list;
  });

  readonly tierOptions = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    return this.tiers()
      .filter(t => String(t.categoryId) === cat.uuid || String(t.categoryId) === cat.id)
      .sort(compareTiers);
  });
  readonly tiersAvailable = computed(() => this.tierOptions().length > 0);
  readonly selectedTier = computed(() => this.tierOptions().find(t => t.name === this.draft().tier) ?? null);

  /** The category's services, plus any the package already has that the category no longer lists. */
  readonly availableServices = computed(() => {
    const listed = this.selectedCategory()?.popularServices ?? [];
    return [...listed, ...this.draft().includes.filter(s => !listed.includes(s))];
  });

  readonly addressLine = computed(() => {
    const a = this.draft().address;
    return [a.street, a.locality, a.city, a.pincode].filter(Boolean).join(', ');
  });

  constructor() {
    this.placeSearch$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(q => (q.trim().length >= 3 ? this.geocoding.search(q) : of([]))),
      takeUntilDestroyed()
    ).subscribe(results => this.suggestions.set(results));
  }

  ngOnInit(): void {
    const pkg$ = this.id ? this.vendorPackages.getById(this.id) : of(null);
    forkJoin({
      categories: this.packageService.getEventTypes(),
      tiers: this.packageService.getTiers(),
      pkg: pkg$
    }).subscribe(({ categories, tiers, pkg }) => {
      this.categories.set(categories);
      this.tiers.set(tiers);
      if (this.id) {
        if (pkg) this.draft.set(draftFromPackage(pkg));
        else void this.toast.error('Could not load this package. Go back and try again.');
        this.loading.set(false);
      } else {
        this.checkReadiness();
      }
    });
  }

  checkReadiness(): void {
    this.loading.set(true);
    forkJoin({
      verification: this.vendorService.getVerificationStatus(),
      profile: this.profileService.getProfile()
    }).subscribe(({ verification, profile }) => {
      this.kycStatus.set(String(verification?.['status'] ?? ''));
      this.readiness.set(vendorReadiness(verification, profile as unknown as VendorBusinessProfile | null));
      this.loading.set(false);
    });
  }

  kycMessage(): string {
    switch (this.kycStatus()) {
      case 'under_review': return 'Documents under review — usually two working days.';
      case 'rejected':
      case 'action_required': return 'Some documents need to be re-uploaded.';
      default: return 'Upload your business documents.';
    }
  }

  // ---- draft edits ---------------------------------------------------------

  patch(changes: Partial<PackageDraft>): void {
    this.draft.update(d => ({ ...d, ...changes }));
    this.problem.set(null);
  }

  setExperience(raw: string | number | null | undefined): void {
    const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    this.patch({ experience: value === null || Number.isNaN(value) ? null : value });
  }

  setAddress(key: keyof PackageAddress, value: string | null | undefined): void {
    this.patch({ address: { ...this.draft().address, [key]: value ?? '' } });
  }

  /** Changing category resets tier and services (they belong to the category), after confirming if any were set. */
  async changeCategory(category: string): Promise<void> {
    const d = this.draft();
    if (category === d.category) return;
    if (d.includes.length || d.tier) {
      const ok = await this.toast.confirm(
        'Change category?', 'The tier and services you selected belong to the current category and will be cleared.', 'Change'
      );
      if (!ok) {
        // Re-render the select back to the current value.
        this.draft.set({ ...d });
        return;
      }
    }
    this.draft.set(withIncludes({ ...d, category, tier: '' }, []));
    this.openService.set(null);
    this.problem.set(null);
  }

  toggleService(name: string): void {
    const includes = this.draft().includes;
    const next = includes.includes(name) ? includes.filter(s => s !== name) : [...includes, name];
    this.draft.set(withIncludes(this.draft(), next));
    if (!includes.includes(name)) this.openService.set(name);
    this.problem.set(null);
  }

  selectAllServices(): void {
    const all = [...new Set([...this.draft().includes, ...this.availableServices()])];
    this.draft.set(withIncludes(this.draft(), all));
  }

  toggleOpen(name: string): void {
    this.openService.set(this.openService() === name ? null : name);
  }

  addDay(): void {
    this.patch({ dayPlan: [...this.draft().dayPlan, emptyDay()] });
  }

  removeDay(index: number): void {
    this.patch({ dayPlan: this.draft().dayPlan.filter((_, i) => i !== index) });
  }

  setDay(index: number, field: 'title' | 'details', value: string | null | undefined): void {
    this.patch({ dayPlan: this.draft().dayPlan.map((d, i) => (i === index ? { ...d, [field]: value ?? '' } : d)) });
  }

  trackUpload(active: boolean): void {
    this.uploads.update(n => Math.max(0, n + (active ? 1 : -1)));
  }

  servicePrice(name: string): string {
    const d = this.draft().details[name];
    if (!d?.minPrice) return '—';
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    const price = d.maxPrice > d.minPrice ? `${fmt(d.minPrice)} – ${fmt(d.maxPrice)}` : fmt(d.minPrice);
    return inclusionKind(name) === 'catering' ? `${price} / plate` : price;
  }

  // ---- address lookup ----------------------------------------------------

  searchPlace(query: string): void {
    this.placeQuery.set(query);
    if (query.trim().length < 3) this.suggestions.set([]);
    this.placeSearch$.next(query);
  }

  applyPlace(place: PlaceSuggestion): void {
    this.placeQuery.set(place.label);
    this.suggestions.set([]);
    const current = this.draft().address;
    // Only overwrite fields the lookup actually knows; keep what the vendor typed otherwise.
    const next = { ...current };
    for (const [key, value] of Object.entries(place.address) as [keyof PackageAddress, string][]) {
      if (value) next[key] = value;
    }
    this.patch({ address: next });
  }

  async useCurrentLocation(): Promise<void> {
    this.locating.set(true);
    try {
      const { lat, lng } = await this.geocoding.currentPosition();
      this.geocoding.reverse(lat, lng).subscribe(place => {
        this.locating.set(false);
        if (!place) {
          void this.toast.error('Could not find an address here. Enter it below.');
          return;
        }
        this.applyPlace(place);
      });
    } catch (error) {
      this.locating.set(false);
      void this.toast.error((error as Error).message);
    }
  }

  // ---- navigation & save -------------------------------------------------

  next(): void {
    const d = this.draft();
    const problem = this.step() === 1 ? validateBasics(d)
      : this.step() === 2 ? validateServices(d, this.selectedTier(), this.tiersAvailable())
      : this.step() === 3 ? validateDayPlan(d) : null;
    if (problem) {
      this.show(problem);
      return;
    }
    this.goTo(this.step() + 1);
  }

  goTo(step: number): void {
    if (step < 1 || step > 4) return;
    this.problem.set(null);
    this.step.set(step);
    void (document.querySelector('app-vendor-package-editor ion-content') as HTMLIonContentElement | null)?.scrollToTop(200);
  }

  async submit(): Promise<void> {
    const problem = validateDraft(this.draft(), this.selectedTier(), this.tiersAvailable());
    if (problem) {
      this.show(problem);
      return;
    }
    const ok = await this.toast.confirm(
      this.id ? 'Save changes?' : 'Submit for review?',
      'Our team reviews every package before it is shown to customers. You\'ll be notified once it\'s live.',
      this.id ? 'Save' : 'Submit'
    );
    if (!ok) return;

    this.saving.set(true);
    const payload = draftToPayload(this.draft());
    const request$ = this.id ? this.vendorPackages.update(this.id, payload) : this.vendorPackages.create(payload);
    request$.subscribe(result => {
      this.saving.set(false);
      if (result.error || !result.id) {
        void this.toast.error(result.error ?? 'Could not save the package. Please try again.');
        return;
      }
      void this.toast.success(this.id ? 'Package updated — it goes live again once re-verified.' : 'Package submitted — it goes live once verified.');
      this.vendorPackages.markChanged();
      void this.nav.navigateBack('/vendor/tabs/packages');
    });
  }

  /** Jumps to the step (and service) a problem is in, and says what to fix. */
  private show(problem: DraftProblem): void {
    this.step.set(problem.step);
    this.problem.set(problem);
    if (problem.service) this.openService.set(problem.service);
    void this.toast.error(problem.message);
  }
}
