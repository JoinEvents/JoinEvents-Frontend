import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonIcon, IonButton, IonButtons,
  IonChip, IonLabel, IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent,
  IonModal, IonRange, IonSelect, IonSelectOption, IonItem
} from '@ionic/angular/standalone';

import { PackageService, PackageSearchParams } from '../../core/services/package.service';
import { LocationService } from '../../core/services/location.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { EventPackage, EventType } from '../../core/models/event.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * Package discovery. Category chips + search + a filter sheet, with results
 * paged in by infinite scroll rather than the web app's numbered pagination —
 * page controls are awkward with a thumb.
 */
@Component({
  selector: 'app-customer-events',
  standalone: true,
  imports: [
    FormsModule, RouterLink, DecimalPipe, TitleCasePipe, CurrencyInrPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonIcon, IonButton, IonButtons,
    IonChip, IonLabel, IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent,
    IonModal, IonRange, IonSelect, IonSelectOption, IonItem
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Browse</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="filtersOpen.set(true)">
            <ion-icon slot="icon-only" name="options-outline" />
            @if (activeFilterCount() > 0) { <span class="fdot">{{ activeFilterCount() }}</span> }
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Search packages and vendors" [debounce]="400"
                       [value]="query()" (ionInput)="onSearch($any($event.target).value)" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="reload($event)">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Category chips ------------------------------------------------- -->
      <div class="chips">
        <ion-chip [outline]="category() !== null" (click)="setCategory(null)">
          <ion-label>All</ion-label>
        </ion-chip>
        @for (type of categories(); track type.id) {
          <ion-chip [outline]="category() !== type.id" (click)="setCategory(type.id)">
            <ion-label>{{ type.name }}</ion-label>
          </ion-chip>
        }
      </div>

      <div class="je-section">
        @if (loading() && !packages().length) {
          <app-list-skeleton [count]="5" />
        } @else if (!packages().length) {
          <app-empty-state
            icon="search-outline"
            title="No packages match"
            message="Try a different category, widen your budget, or clear the filters."
            actionLabel="Clear filters"
            (action)="clearFilters()" />
        } @else {
          @for (pkg of packages(); track pkg.id) {
            <a class="je-card je-card--flush card" [routerLink]="['/customer/package', pkg.id]">
              <div class="card__art">
                @if (pkg.image) {
                  <img [src]="pkg.image" [alt]="pkg.name" loading="lazy" />
                } @else {
                  <div class="card__art--blank"><ion-icon name="image-outline" /></div>
                }
                <button class="fav" (click)="toggleFavorite($event, pkg)"
                        [attr.aria-label]="favorites.isFavorite(pkg.id) ? 'Remove from saved' : 'Save package'">
                  <ion-icon [name]="favorites.isFavorite(pkg.id) ? 'heart' : 'heart-outline'"
                            [color]="favorites.isFavorite(pkg.id) ? 'danger' : undefined" />
                </button>
                @if (pkg.isPopular) { <span class="tag">Popular</span> }
              </div>

              <div class="card__body">
                <div class="card__head">
                  <strong class="je-clamp-2">{{ pkg.name }}</strong>
                  @if (pkg.rating) {
                    <span class="rating">
                      <ion-icon name="star" /> {{ pkg.rating | number: '1.1-1' }}
                    </span>
                  }
                </div>
                <p class="je-xs je-muted je-truncate">
                  {{ pkg.vendorName || 'JoinEvents partner' }}
                  @if (pkg.address?.city) { · {{ pkg.address?.city }} }
                </p>
                <div class="card__meta">
                  @if (pkg.maxGuests) {
                    <span class="je-xs je-soft"><ion-icon name="people-outline" /> Up to {{ pkg.maxGuests }}</span>
                  }
                  @if (pkg.tier) { <span class="je-pill je-pill--neutral">{{ pkg.tier | titlecase }}</span> }
                </div>
                <div class="card__foot">
                  <span class="je-price">{{ pkg.price | inr }}</span>
                  <span class="je-xs je-soft">onwards</span>
                </div>
              </div>
            </a>
          }

          <ion-infinite-scroll (ionInfinite)="loadMore($event)" [disabled]="!hasMore()">
            <ion-infinite-scroll-content loadingSpinner="crescent" />
          </ion-infinite-scroll>
        }
      </div>
    </ion-content>

    <!-- Filter sheet ------------------------------------------------------ -->
    <ion-modal [isOpen]="filtersOpen()" (didDismiss)="filtersOpen.set(false)"
               [initialBreakpoint]="0.75" [breakpoints]="[0, 0.75, 1]">
      <ng-template>
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>Filters</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="filtersOpen.set(false)">Done</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <label class="flabel">Budget — up to {{ maxPrice() | inr: true }}</label>
          <ion-range [min]="10000" [max]="2000000" [step]="10000" [value]="maxPrice()"
                     (ionChange)="maxPrice.set($any($event.detail.value))" color="primary" />

          <label class="flabel">Guests</label>
          <ion-item class="je-field" lines="none">
            <ion-select [value]="guests()" placeholder="Any number"
                        (ionChange)="guests.set($any($event.detail.value))" interface="action-sheet">
              <ion-select-option [value]="null">Any number</ion-select-option>
              <ion-select-option [value]="50">Up to 50</ion-select-option>
              <ion-select-option [value]="150">Up to 150</ion-select-option>
              <ion-select-option [value]="300">Up to 300</ion-select-option>
              <ion-select-option [value]="600">Up to 600</ion-select-option>
              <ion-select-option [value]="1000">1000+</ion-select-option>
            </ion-select>
          </ion-item>

          <label class="flabel">Tier</label>
          <ion-item class="je-field" lines="none">
            <ion-select [value]="tier()" placeholder="Any tier"
                        (ionChange)="tier.set($any($event.detail.value))" interface="action-sheet">
              <ion-select-option [value]="null">Any tier</ion-select-option>
              <ion-select-option value="basic">Basic</ion-select-option>
              <ion-select-option value="standard">Standard</ion-select-option>
              <ion-select-option value="premium">Premium</ion-select-option>
            </ion-select>
          </ion-item>

          <label class="flabel">Sort by</label>
          <ion-item class="je-field" lines="none">
            <ion-select [value]="sort()" (ionChange)="sort.set($any($event.detail.value))" interface="action-sheet">
              <ion-select-option value="relevance">Most relevant</ion-select-option>
              <ion-select-option value="price_asc">Price: low to high</ion-select-option>
              <ion-select-option value="price_desc">Price: high to low</ion-select-option>
              <ion-select-option value="rating">Highest rated</ion-select-option>
            </ion-select>
          </ion-item>

          <div class="fbtns">
            <ion-button expand="block" fill="outline" (click)="clearFilters()">Clear all</ion-button>
            <ion-button expand="block" class="je-btn-gradient" (click)="applyFilters()">Show results</ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .fdot { position: absolute; top: 0; right: 0; min-width: 16px; height: 16px; padding: 0 4px;
            border-radius: 8px; background: var(--je-danger); color: #fff;
            font-size: 10px; font-weight: 700; line-height: 16px; }
    .chips { display: flex; gap: 8px; overflow-x: auto; padding: 10px 16px 4px; scrollbar-width: none; }
    .chips::-webkit-scrollbar { display: none; }
    ion-chip { flex-shrink: 0; --background: var(--je-primary); --color: #fff; font-weight: 600; }
    ion-chip[outline] { --background: transparent; --color: var(--je-text-muted); }

    .card { display: flex; gap: 0; text-decoration: none; flex-direction: column; }
    .card__art { position: relative; height: 168px; background: var(--je-bg-light); }
    .card__art img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .card__art--blank { width: 100%; height: 100%; display: grid; place-items: center; }
    .card__art--blank ion-icon { font-size: 34px; color: var(--je-text-soft); }
    .fav { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px;
           border: none; border-radius: 50%; background: rgba(255,255,255,0.94);
           display: grid; place-items: center; box-shadow: var(--je-shadow-sm); }
    .fav ion-icon { font-size: 18px; }
    .tag { position: absolute; top: 10px; left: 10px; padding: 4px 10px;
           border-radius: var(--je-radius-full); background: var(--je-gradient-primary);
           color: #fff; font-size: var(--je-fs-xs); font-weight: 700; }

    .card__body { padding: 14px 16px 16px; }
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .card__head strong { font-size: var(--je-fs-base); color: var(--je-text-main); line-height: 1.35; }
    .rating { display: flex; align-items: center; gap: 3px; flex-shrink: 0;
              font-size: var(--je-fs-xs); font-weight: 700; color: var(--je-text-main); }
    .rating ion-icon { color: var(--je-accent); font-size: 13px; }
    .card__meta { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    .card__meta span { display: inline-flex; align-items: center; gap: 4px; }
    .card__foot { display: flex; align-items: baseline; gap: 6px; margin-top: 12px;
                  padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .card__foot .je-price { font-size: var(--je-fs-md); }

    .flabel { display: block; font-size: var(--je-fs-sm); font-weight: 600;
              color: var(--je-text-main); margin: 18px 0 8px; }
    .fbtns { display: flex; flex-direction: column; gap: 10px; margin-top: 28px; }
  `]
})
export class CustomerEventsPage implements OnInit {
  favorites = inject(FavoritesService);
  private packageService = inject(PackageService);
  private location = inject(LocationService);
  private route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly packages = signal<EventPackage[]>([]);
  readonly categories = signal<EventType[]>([]);
  readonly hasMore = signal(true);
  readonly filtersOpen = signal(false);

  readonly query = signal('');
  readonly category = signal<string | null>(null);
  readonly maxPrice = signal(2_000_000);
  readonly guests = signal<number | null>(null);
  readonly tier = signal<string | null>(null);
  readonly sort = signal('relevance');

  private page = 1;
  private readonly pageSize = 12;

  ngOnInit(): void {
    this.category.set(this.route.snapshot.queryParamMap.get('category'));
    this.packageService.getEventTypes().subscribe(types => this.categories.set(types));
    this.fetch(true);
  }

  onSearch(value: string): void {
    this.query.set(value ?? '');
    this.fetch(true);
  }

  setCategory(id: string | null): void {
    this.category.set(id);
    this.fetch(true);
  }

  applyFilters(): void {
    this.filtersOpen.set(false);
    this.fetch(true);
  }

  clearFilters(): void {
    this.maxPrice.set(2_000_000);
    this.guests.set(null);
    this.tier.set(null);
    this.sort.set('relevance');
    this.category.set(null);
    this.filtersOpen.set(false);
    this.fetch(true);
  }

  activeFilterCount(): number {
    let count = 0;
    if (this.maxPrice() < 2_000_000) count++;
    if (this.guests() !== null) count++;
    if (this.tier() !== null) count++;
    if (this.sort() !== 'relevance') count++;
    return count;
  }

  reload(event?: CustomEvent): void {
    this.fetch(true, () => void (event?.target as HTMLIonRefresherElement | undefined)?.complete());
  }

  loadMore(event: CustomEvent): void {
    this.page++;
    this.fetch(false, () => void (event.target as HTMLIonInfiniteScrollElement).complete());
  }

  toggleFavorite(event: Event, pkg: EventPackage): void {
    // The card is a link; without this the tap would navigate away instead.
    event.preventDefault();
    event.stopPropagation();
    this.favorites.toggle({
      id: pkg.id,
      name: pkg.name,
      image: pkg.image,
      price: pkg.price,
      vendorName: pkg.vendorName,
      routeUrl: `/customer/package/${pkg.id}`
    });
  }

  private fetch(reset: boolean, done?: () => void): void {
    if (reset) {
      this.page = 1;
      this.hasMore.set(true);
      this.loading.set(true);
    }

    const params: PackageSearchParams = {
      category: this.category() ?? undefined,
      city: this.location.selectedCity() ?? undefined,
      maxPrice: this.maxPrice() < 2_000_000 ? this.maxPrice() : undefined,
      guests: this.guests() ?? undefined,
      tier: this.tier() ?? undefined,
      sort: this.sort() === 'relevance' ? undefined : this.sort(),
      page: this.page,
      pageSize: this.pageSize
    };

    this.packageService.search(params).subscribe(results => {
      const filtered = this.applyLocalQuery(results);
      this.packages.set(reset ? filtered : [...this.packages(), ...filtered]);
      // A short page means the server has nothing left to give.
      this.hasMore.set(results.length >= this.pageSize);
      this.loading.set(false);
      done?.();
    });
  }

  /**
   * The search endpoint takes no free-text term, so the typed query is matched
   * client-side over the page that came back. Swap this for a server-side
   * `q` parameter when the API gains one.
   */
  private applyLocalQuery(results: EventPackage[]): EventPackage[] {
    const term = this.query().trim().toLowerCase();
    if (!term) return results;
    return results.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.vendorName ?? '').toLowerCase().includes(term) ||
      (p.description ?? '').toLowerCase().includes(term)
    );
  }
}
