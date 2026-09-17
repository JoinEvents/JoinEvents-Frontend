import { Component, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonToggle,
  IonFab, IonFabButton, IonRefresher, IonRefresherContent,
  IonItemSliding, IonItemOptions, IonItemOption, IonList
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { VendorPackageService, VendorPackage } from '../../core/services/vendor-package.service';
import { ToastService } from '../../core/services/toast.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

/** The vendor's catalogue, with inline activate/deactivate and swipe-to-delete. */
@Component({
  selector: 'app-vendor-packages',
  standalone: true,
  imports: [
    TitleCasePipe, RouterLink, CurrencyInrPipe, ListSkeletonComponent, EmptyStateComponent, StatusPillComponent,
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
                        {{ pkg.category | titlecase }}
                        @if (pkg.tier) { · {{ pkg.tier | titlecase }} }
                      </span>
                      <span class="je-price je-sm">{{ pkg.price | inr }}</span>
                      <app-status-pill [status]="pkg.status" />
                    </div>
                  </a>

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
  `]
})
export class VendorPackagesPage implements ViewWillEnter {
  private packageService = inject(VendorPackageService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly loading = signal(true);
  readonly packages = signal<VendorPackage[]>([]);

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
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

    this.packageService.toggleStatus(pkg.id, isActive).subscribe(success => {
      if (success) return;
      this.packages.update(list => list.map(p => (p.id === pkg.id ? { ...p, isActive: !isActive } : p)));
      void this.toast.error('Could not change the package status.');
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

    this.packageService.remove(pkg.id).subscribe(success => {
      if (!success) {
        void this.toast.error('Could not delete the package.');
        return;
      }
      void this.toast.success('Package deleted.');
      this.load();
    });
  }
}
