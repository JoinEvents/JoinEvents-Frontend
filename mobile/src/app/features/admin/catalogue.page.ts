import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel, IonIcon,
  IonFab, IonFabButton, IonButton, IonToggle, IonRefresher, IonRefresherContent, IonSearchbar,
  IonSelect, IonSelectOption, IonItem
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { AdminCatalogueService } from '../../core/services/admin-catalogue.service';
import { ToastService } from '../../core/services/toast.service';
import { EventCategory, Tier } from '../../core/models/catalogue.model';
import { compareTiers } from '../../core/utils/catalogue.util';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type Tab = 'categories' | 'tiers';
type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Catalogue configuration: the event categories and pricing tiers every vendor
 * package is built from — the same records, fields and actions as the web
 * console's Categories and Tiers screens. Everything shown comes from the API.
 */
@Component({
  selector: 'app-admin-catalogue',
  standalone: true,
  imports: [
    CurrencyInrPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel, IonIcon,
    IonFab, IonFabButton, IonButton, IonToggle, IonRefresher, IonRefresherContent, IonSearchbar,
    IonSelect, IonSelectOption, IonItem
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Catalogue</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab()" (ionChange)="tab.set($any($event.detail.value))">
          <ion-segment-button value="categories">
            <ion-label>Categories ({{ categories().length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="tiers">
            <ion-label>Tiers ({{ tiers().length }})</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        <ion-searchbar [value]="query()" (ionInput)="query.set($any($event.target).value ?? '')"
                       [placeholder]="tab() === 'categories' ? 'Search categories' : 'Search tiers'"
                       class="search" />

        <div class="filters">
          @for (f of statusFilters; track f.value) {
            <button type="button" class="chip" [class.chip--on]="status() === f.value" (click)="status.set(f.value)">
              {{ f.label }}
            </button>
          }
        </div>

        @if (tab() === 'tiers' && categories().length) {
          <ion-item class="je-field" lines="none">
            <ion-select [value]="tierCategory()" interface="action-sheet" label="Category"
                        (ionChange)="tierCategory.set($any($event.detail.value))">
              <ion-select-option value="all">All categories</ion-select-option>
              @for (c of categories(); track c.id) {
                <ion-select-option [value]="c.id">{{ c.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        }

        @if (error()) {
          <div class="je-card banner">
            <span class="je-sm">{{ error() }}</span>
            <ion-button size="small" fill="clear" (click)="load()">Retry</ion-button>
          </div>
        }

        @if (loading()) {
          <app-list-skeleton [count]="5" />
        } @else if (tab() === 'categories') {
          @for (cat of filteredCategories(); track cat.id) {
            <div class="je-card je-card--flush card" [class.card--off]="cat.isActive === false">
              <div class="card__head" [style.background]="cat.gradient || 'var(--je-gradient-primary)'">
                <span class="card__icon"><i class="bi {{ cat.icon }}"></i></span>
                <div class="card__acts">
                  <ion-toggle [checked]="cat.isActive !== false" aria-label="Active"
                              (ionChange)="toggleCategory(cat, $any($event.detail.checked))" />
                  <ion-button size="small" fill="clear" class="on-grad" (click)="editCategory(cat)" aria-label="Edit">
                    <ion-icon slot="icon-only" name="create-outline" />
                  </ion-button>
                  <ion-button size="small" fill="clear" class="on-grad" (click)="deleteCategory(cat)" aria-label="Delete">
                    <ion-icon slot="icon-only" name="trash-outline" />
                  </ion-button>
                </div>
              </div>
              <div class="card__body">
                <strong>{{ cat.name }}</strong>
                <div class="meta">
                  <span class="key"><i class="bi bi-key-fill"></i> {{ cat.categoryKey }}</span>
                  @if (cat.nameHindi) { <span class="je-xs je-muted">{{ cat.nameHindi }}</span> }
                  @if (cat.isActive === false) { <span class="je-pill je-pill--neutral">Inactive</span> }
                </div>
                @if (cat.description) { <p class="je-xs je-muted je-clamp-2">{{ cat.description }}</p> }
                @if (cat.startingPrice) { <span class="je-xs je-bold">From {{ cat.startingPrice | inr }}</span> }
                @if (cat.popularServices?.length) {
                  <div class="tags">
                    @for (svc of cat.popularServices!.slice(0, 4); track svc) { <span class="tag">{{ svc }}</span> }
                    @if (cat.popularServices!.length > 4) { <span class="tag">+{{ cat.popularServices!.length - 4 }}</span> }
                  </div>
                }
              </div>
            </div>
          } @empty {
            <app-empty-state
              icon="pricetags-outline"
              [title]="categories().length ? 'No matching categories' : 'No categories yet'"
              [message]="categories().length ? 'Try a different search or filter.' : 'Create the first event category vendors can list under.'"
              [actionLabel]="categories().length ? null : 'Add category'"
              (action)="create()" />
          }
        } @else {
          @for (tier of filteredTiers(); track tier.id) {
            <div class="je-card je-card--flush card" [class.card--off]="tier.isActive === false">
              <div class="card__head" [style.background]="tier.gradient || tier.categoryGradient || 'var(--je-gradient-primary)'">
                <span class="card__icon"><i class="bi {{ tier.icon }}"></i></span>
                <div class="card__acts">
                  <ion-toggle [checked]="tier.isActive !== false" aria-label="Active"
                              (ionChange)="toggleTier(tier, $any($event.detail.checked))" />
                  <ion-button size="small" fill="clear" class="on-grad" (click)="editTier(tier)" aria-label="Edit">
                    <ion-icon slot="icon-only" name="create-outline" />
                  </ion-button>
                  <ion-button size="small" fill="clear" class="on-grad" (click)="deleteTier(tier)" aria-label="Delete">
                    <ion-icon slot="icon-only" name="trash-outline" />
                  </ion-button>
                </div>
              </div>
              <div class="card__body">
                <strong>{{ tier.name }}</strong>
                <div class="meta">
                  <span class="key"><i class="bi bi-grid-fill"></i> {{ tier.categoryName || categoryName(tier.categoryId) }}</span>
                  @if (tier.isActive === false) { <span class="je-pill je-pill--neutral">Inactive</span> }
                </div>
                @if (tier.description) { <p class="je-xs je-muted je-clamp-2">{{ tier.description }}</p> }
                @if (tier.priceRanges.length) {
                  <div class="ranges">
                    @for (r of tier.priceRanges; track r.serviceName) {
                      <div class="ranges__row je-xs">
                        <span class="je-truncate">{{ r.serviceName }}</span>
                        <span class="je-bold">{{ r.minPrice | inr }} – {{ r.maxPrice | inr }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <span class="je-xs je-soft">No service price ranges set.</span>
                }
              </div>
            </div>
          } @empty {
            <app-empty-state
              icon="layers-outline"
              [title]="tiers().length ? 'No matching tiers' : 'No tiers yet'"
              [message]="tiers().length ? 'Try a different search or filter.' : (categories().length ? 'Create a pricing tier for a category.' : 'Create a category first — every tier belongs to one.')"
              [actionLabel]="tiers().length || !categories().length ? null : 'Add tier'"
              (action)="create()" />
          }
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button class="fab" (click)="create()" [attr.aria-label]="'Add ' + (tab() === 'categories' ? 'category' : 'tier')">
          <ion-icon name="add" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .search { padding: 0; --border-radius: 12px; margin-bottom: 6px; }
    .filters { display: flex; gap: 8px; margin-bottom: 10px; }
    .chip { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--je-border-color);
            background: var(--je-bg-card); color: var(--je-text-main); font-size: var(--je-fs-xs); font-weight: 600; }
    .chip--on { background: var(--je-primary); border-color: var(--je-primary); color: #fff; }
    .banner { display: flex; align-items: center; justify-content: space-between; gap: 8px;
              border-left: 3px solid var(--je-danger); }
    .card { overflow: hidden; margin-bottom: 12px; }
    .card--off { opacity: 0.6; }
    .card__head { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px 10px 12px; }
    .card__icon { width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.22);
                  display: grid; place-items: center; color: #fff; font-size: 20px; }
    .card__acts { display: flex; align-items: center; }
    .card__acts ion-toggle { margin-right: 4px; }
    .on-grad { --color: #fff; }
    .card__body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
    .card__body p { margin: 0; }
    .meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .key { font-size: var(--je-fs-xs); font-weight: 600; color: var(--je-text-muted); font-family: monospace; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { padding: 3px 9px; border-radius: 999px; background: var(--je-bg-light); font-size: var(--je-fs-xs); font-weight: 600; }
    .ranges { display: flex; flex-direction: column; gap: 4px; background: var(--je-bg-light);
              border-radius: var(--je-radius-sm); padding: 8px 10px; }
    .ranges__row { display: flex; justify-content: space-between; gap: 10px; }
    .fab { --background: var(--je-gradient-primary); --color: #fff; }
  `]
})
export class AdminCataloguePage implements ViewWillEnter {
  private catalogue = inject(AdminCatalogueService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<EventCategory[]>([]);
  readonly tiers = signal<Tier[]>([]);

  readonly tab = signal<Tab>('categories');
  readonly query = signal('');
  readonly status = signal<StatusFilter>('all');
  readonly tierCategory = signal('all');

  readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  readonly filteredCategories = computed(() => {
    const q = this.query().toLowerCase().trim();
    return this.categories().filter(c =>
      this.matchesStatus(c.isActive) &&
      (!q || [c.name, c.nameHindi, c.description, c.categoryKey].some(v => v?.toLowerCase().includes(q)))
    );
  });

  readonly filteredTiers = computed(() => {
    const q = this.query().toLowerCase().trim();
    const cat = this.tierCategory();
    return this.tiers()
      .filter(t =>
        this.matchesStatus(t.isActive) &&
        (cat === 'all' || String(t.categoryId) === cat) &&
        (!q || [t.name, t.categoryName, t.description].some(v => v?.toLowerCase().includes(q)))
      )
      .sort(compareTiers);
  });

  constructor() {
    // Reload whenever a write lands anywhere (including in the editor pages),
    // and on first display. untracked: load() itself reads signals.
    let first = true;
    effect(() => {
      this.catalogue.version();
      untracked(() => this.load(undefined, !first));
      first = false;
    });
    // Editors return with ?tab= so the admin lands on the list they changed.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const tab = params.get('tab');
      if (tab === 'categories' || tab === 'tiers') this.tab.set(tab);
    });
  }

  ionViewWillEnter(): void {
    // Returning to the tab from elsewhere in the app: pick up changes made on the web.
    if (!this.loading()) this.load(undefined, true);
  }

  /** `quiet` refreshes in place (no skeleton) when data is already on screen. */
  load(event?: CustomEvent, quiet = false): void {
    if (!event && !quiet) this.loading.set(true);
    this.error.set(null);
    this.catalogue.getCategories().subscribe(categories => {
      this.catalogue.getTiers().subscribe(tiers => {
        this.categories.set(categories.data ?? []);
        this.tiers.set(tiers.data ?? []);
        this.error.set(categories.error ?? tiers.error ?? null);
        this.loading.set(false);
        void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
      });
    });
  }

  categoryName(id: string): string {
    return this.categories().find(c => String(c.id) === String(id))?.name ?? '';
  }

  // ---- navigation ------------------------------------------------------

  create(): void {
    if (this.tab() === 'tiers' && !this.categories().length) {
      void this.toast.error('Create a category first — every tier belongs to one.');
      return;
    }
    void this.router.navigate(['/admin/catalogue', this.tab() === 'categories' ? 'category' : 'tier', 'new']);
  }

  editCategory(cat: EventCategory): void {
    void this.router.navigate(['/admin/catalogue/category', cat.id]);
  }

  editTier(tier: Tier): void {
    void this.router.navigate(['/admin/catalogue/tier', tier.id]);
  }

  // ---- status ------------------------------------------------------------

  toggleCategory(cat: EventCategory, isActive: boolean): void {
    if ((cat.isActive !== false) === isActive) return;
    this.catalogue.toggleCategory(cat.id, isActive).subscribe(result => {
      if (result.error || !result.data) {
        void this.toast.error(result.error ?? 'Could not change the status.');
        this.load();
        return;
      }
      this.categories.update(list => list.map(c => c.id === cat.id ? result.data! : c));
    });
  }

  toggleTier(tier: Tier, isActive: boolean): void {
    if ((tier.isActive !== false) === isActive) return;
    this.catalogue.toggleTier(tier.id, isActive).subscribe(result => {
      if (result.error || !result.data) {
        void this.toast.error(result.error ?? 'Could not change the status.');
        this.load();
        return;
      }
      this.tiers.update(list => list.map(t => t.id === tier.id ? result.data! : t));
    });
  }

  // ---- delete ------------------------------------------------------------

  async deleteCategory(cat: EventCategory): Promise<void> {
    const confirmed = await this.toast.confirm(
      `Delete "${cat.name}"?`,
      'This cannot be undone. A category that vendors have listed packages under cannot be deleted — deactivate it instead.',
      'Delete', true
    );
    if (!confirmed) return;
    this.catalogue.deleteCategory(cat.id).subscribe(result => {
      if (result.error) {
        void this.toast.error(result.error);
        return;
      }
      this.categories.update(list => list.filter(c => c.id !== cat.id));
      void this.toast.success('Category deleted.');
    });
  }

  async deleteTier(tier: Tier): Promise<void> {
    const confirmed = await this.toast.confirm(
      `Delete the "${tier.name}" tier?`, 'This cannot be undone.', 'Delete', true
    );
    if (!confirmed) return;
    this.catalogue.deleteTier(tier.id).subscribe(result => {
      if (result.error) {
        void this.toast.error(result.error);
        return;
      }
      this.tiers.update(list => list.filter(t => t.id !== tier.id));
      void this.toast.success('Tier deleted.');
    });
  }

  private matchesStatus(isActive: boolean | undefined): boolean {
    const status = this.status();
    if (status === 'active') return isActive !== false;
    if (status === 'inactive') return isActive === false;
    return true;
  }
}
