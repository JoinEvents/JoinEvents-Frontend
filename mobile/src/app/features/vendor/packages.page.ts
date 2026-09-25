import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonToggle,
  IonFab, IonFabButton, IonRefresher, IonRefresherContent,
  IonItemSliding, IonItemOptions, IonItemOption, IonList
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { VendorPackageService, VendorPackage } from '../../core/services/vendor-package.service';
import { ToastService } from '../../core/services/toast.service';
import { PackageService } from '../../core/services/package.service';
import { EventType } from '../../core/models/event.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** The vendor's catalogue, with inline activate/deactivate and swipe-to-delete. */
@Component({
  selector: 'app-vendor-packages',
  standalone: true,
  imports: [
    RouterLink, CurrencyInrPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonToggle,
    IonFab, IonFabButton, IonRefresher, IonRefresherContent,
    IonItemSliding, IonItemOptions, IonItemOption, IonList
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>My packages</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="3" />
        } @else if (!packages().length) {
          <app-empty-state
            icon="cube-outline"
            title="No packages yet"
            message="List a package so customers can find and book you."
            actionLabel="Create a package"
            (action)="create()" />
        } @else {
          <ion-list [inset]="false" class="list">
            @for (pkg of packages(); track pkg.id) {
              <ion-item-sliding>
                <div class="je-card card" [class.card--off]="!pkg.isActive">
                  <a class="card__main" [routerLink]="['/vendor/package', pkg.id]">
                    @if (pkg.images.length) {
                      <img [src]="pkg.images[0]" [alt]="pkg.name" class="thumb" />
                    } @else {
                      <div class="thumb thumb--blank"><ion-icon name="image-outline" /></div>
                    }
                    <div class="card__body">
                      <strong class="je-sm je-clamp-2">{{ pkg.name }}</strong>
                      <span class="je-xs je-muted">
                        {{ categoryName(pkg.category) }}
                        @if (pkg.tier) { · {{ pkg.tier }} }
                      </span>
                      <span class="je-price je-sm">{{ pkg.price | inr }}</span>
                      <span class="je-pill" [class]="'je-pill--' + statusOf(pkg).tone">{{ statusOf(pkg).label }}</span>
                    </div>
                  </a>
                  @if (pkg.status === 'Rejected' && pkg.verificationComment) {
                    <p class="je-xs note"><strong>Reviewer:</strong> {{ pkg.verificationComment }}</p>
                  }

                  <div class="card__foot">
                    <div class="metrics">
                      @if (pkg.totalBookings !== undefined) {
                        <span class="je-xs je-muted">
                          <ion-icon name="journal-outline" /> {{ pkg.totalBookings }} bookings
                        </span>
                      }
                      @if (pkg.rating) {
                        <span class="je-xs je-muted"><ion-icon name="star" /> {{ pkg.rating }}</span>
                      }
                    </div>
                    <div class="live">
                      <span class="je-xs je-muted">{{ pkg.isActive ? 'Live' : 'Hidden' }}</span>
                      <ion-toggle [checked]="pkg.isActive"
                                  (ionChange)="toggle(pkg, $any($event.detail.checked))" />
                    </div>
                  </div>
                </div>

                <ion-item-options side="end">
                  <ion-item-option color="danger" (click)="remove(pkg)">
                    <ion-icon slot="icon-only" name="trash-outline" />
                  </ion-item-option>
                </ion-item-options>
              </ion-item-sliding>
            }
          </ion-list>
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button class="fab" (click)="create()"><ion-icon name="add" /></ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .list { background: transparent; }
    .card--off { opacity: 0.62; }
    .card__main { display: flex; gap: 14px; text-decoration: none; }
    .thumb { width: 74px; height: 74px; flex-shrink: 0; border-radius: var(--je-radius-sm); object-fit: cover; }
    .thumb--blank { display: grid; place-items: center; background: var(--je-bg-light); }
    .thumb--blank ion-icon { font-size: 26px; color: var(--je-text-soft); }
    .card__body { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-width: 0; flex: 1; }
    .card__body strong { color: var(--je-text-main); }
    .card__foot { display: flex; align-items: center; justify-content: space-between;
                  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
    .metrics { display: flex; gap: 14px; }
    .metrics span { display: inline-flex; align-items: center; gap: 4px; }
    .live { display: flex; align-items: center; gap: 8px; }
    .fab { --background: var(--je-gradient-primary); --color: #fff; }
    .note { margin: 10px 0 0; padding: 8px 10px; border-radius: var(--je-radius-sm);
            background: var(--je-bg-light); color: var(--je-text-main); }
  `]
})
export class VendorPackagesPage implements ViewWillEnter {
  private packageService = inject(VendorPackageService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private catalogue = inject(PackageService);

  readonly loading = signal(true);
  readonly packages = signal<VendorPackage[]>([]);
  private readonly categories = signal<EventType[]>([]);

  constructor() {
    // Reload after the editor saves (see VendorPackageService.version).
    let first = true;
    effect(() => {
      this.packageService.version();
      if (!first) untracked(() => this.load(undefined, true));
      first = false;
    });
    this.catalogue.getEventTypes().subscribe(types => this.categories.set(types));
  }

  /** Category names from the catalogue; the package stores the key. */
  categoryName(key: string): string {
    return this.categories().find(c => c.id === key)?.name ?? key;
  }

  /** The API's review states, in the vendor's words. */
  statusOf(pkg: VendorPackage): { label: string; tone: string } {
    switch (pkg.status) {
      case 'Active': return { label: 'Verified', tone: 'confirmed' };
      case 'Rejected': return { label: 'Changes needed', tone: 'rejected' };
      case 'PendingReview': return { label: 'Under review', tone: 'pending' };
      default: return { label: pkg.status || 'Unknown', tone: 'neutral' };
    }
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent, quiet = false): void {
    if (!event && !quiet) this.loading.set(true);
    this.packageService.getMyPackages().subscribe(packages => {
      this.packages.set(packages);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  create(): void {
    void this.router.navigate(['/vendor/package/new']);
  }

  toggle(pkg: VendorPackage, isActive: boolean): void {
    // Optimistic: the toggle has already moved, so reflect it and roll back on failure.
    this.packages.update(list => list.map(p => (p.id === pkg.id ? { ...p, isActive } : p)));

    this.packageService.toggleStatus(pkg.id, isActive).subscribe(error => {
      if (!error) return;
      this.packages.update(list => list.map(p => (p.id === pkg.id ? { ...p, isActive: !isActive } : p)));
      void this.toast.error(error);
    });
  }

  async remove(pkg: VendorPackage): Promise<void> {
    const confirmed = await this.toast.confirm(
      'Delete this package?',
      `"${pkg.name}" will be removed permanently. Existing bookings are unaffected.`,
      'Delete',
      true
    );
    if (!confirmed) return;

    this.packageService.remove(pkg.id).subscribe(error => {
      if (error) {
        void this.toast.error(error);
        return;
      }
      void this.toast.success('Package deleted.');
      this.load();
    });
  }
}
