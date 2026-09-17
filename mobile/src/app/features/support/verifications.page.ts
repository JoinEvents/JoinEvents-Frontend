import { Component, inject, signal } from '@angular/core';
import { Browser } from '@capacitor/browser';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel,
  IonIcon, IonButton, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { SupportService } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { PhoneMaskPipe } from '../../shared/pipes/phone-mask.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * Approval queue for vendor KYC and new package listings. Both are gated
 * before anything reaches customers, so approve and reject sit on the card.
 */
@Component({
  selector: 'app-support-verifications',
  standalone: true,
  imports: [
    CurrencyInrPipe, PhoneMaskPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel,
    IonIcon, IonButton, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Verification queue</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab()" (ionChange)="switchTab($any($event.detail.value))">
          <ion-segment-button value="vendors">
            <ion-label>Vendors ({{ vendors().length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="packages">
            <ion-label>Packages ({{ packages().length }})</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="4" />
        } @else if (tab() === 'vendors') {
          @if (!vendors().length) {
            <app-empty-state icon="shield-checkmark-outline" title="Queue is clear"
                             message="No vendors are waiting for verification." />
          } @else {
            @for (vendor of vendors(); track $any(vendor['id'])) {
              <div class="je-card card">
                <div class="card__head">
                  <div class="avatar">{{ initials($any(vendor['businessName'] ?? vendor['name'])) }}</div>
                  <div class="card__title">
                    <strong class="je-sm je-truncate">{{ vendor['businessName'] || vendor['name'] }}</strong>
                    <span class="je-xs je-muted je-truncate">{{ vendor['email'] }}</span>
                    <span class="je-xs je-soft">{{ $any(vendor['phone']) | phoneMask }}</span>
                  </div>
                </div>

                @if (vendor['city']) {
                  <p class="je-xs je-muted meta">
                    <ion-icon name="location-outline" /> {{ vendor['city'] }}
                  </p>
                }

                @if ($any(vendor['documents'])?.length) {
                  <div class="docs">
                    @for (doc of $any(vendor['documents']); track $index) {
                      <button class="doc" (click)="openDocument($any(doc['url']))">
                        <ion-icon name="document-text-outline" />
                        <span class="je-xs">{{ doc['documentType'] || doc['type'] }}</span>
                      </button>
                    }
                  </div>
                }

                <div class="acts">
                  <ion-button size="small" fill="outline" color="danger" (click)="rejectVendor(vendor)">
                    Reject
                  </ion-button>
                  <ion-button size="small" class="je-btn-gradient" (click)="approveVendor(vendor)">
                    Approve
                  </ion-button>
                </div>
              </div>
            }
          }
        } @else {
          @if (!packages().length) {
            <app-empty-state icon="cube-outline" title="Nothing pending"
                             message="No packages are waiting for review." />
          } @else {
            @for (pkg of packages(); track $any(pkg['id'])) {
              <div class="je-card card">
                <div class="pkg">
                  @if ($any(pkg['images'])?.length) {
                    <img [src]="$any(pkg['images'])[0]" alt="" class="thumb" />
                  } @else {
                    <div class="thumb thumb--blank"><ion-icon name="image-outline" /></div>
                  }
                  <div class="card__title">
                    <strong class="je-sm je-clamp-2">{{ pkg['name'] }}</strong>
                    <span class="je-xs je-muted je-truncate">{{ pkg['vendorName'] }}</span>
                    <span class="je-price je-sm">{{ $any(pkg['price'] ?? 0) | inr }}</span>
                  </div>
                </div>

                @if (pkg['description']) {
                  <p class="je-xs je-muted je-clamp-3 desc">{{ pkg['description'] }}</p>
                }

                <div class="acts">
                  <ion-button size="small" fill="outline" color="danger" (click)="rejectPackage(pkg)">
                    Reject
                  </ion-button>
                  <ion-button size="small" class="je-btn-gradient" (click)="approvePackage(pkg)">
                    Approve
                  </ion-button>
                </div>
              </div>
            }
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .card__head { display: flex; gap: 12px; align-items: flex-start; }
    .avatar { width: 42px; height: 42px; flex-shrink: 0; display: grid; place-items: center;
              border-radius: 50%; background: var(--je-gradient-secondary); color: #fff;
              font-weight: 700; font-size: var(--je-fs-sm); }
    .card__title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .meta { display: flex; align-items: center; gap: 5px; margin: 12px 0 0; }

    .docs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .doc { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px;
           border: 1px solid var(--je-border-color); border-radius: var(--je-radius-full);
           background: var(--je-bg-light); color: var(--je-text-muted); font-weight: 600; }
    .doc ion-icon { font-size: 14px; }

    .pkg { display: flex; gap: 12px; }
    .thumb { width: 66px; height: 66px; flex-shrink: 0; border-radius: var(--je-radius-sm); object-fit: cover; }
    .thumb--blank { display: grid; place-items: center; background: var(--je-bg-light); }
    .thumb--blank ion-icon { font-size: 24px; color: var(--je-text-soft); }
    .desc { margin: 12px 0 0; line-height: 1.55; }

    .acts { display: flex; gap: 8px; justify-content: flex-end;
            margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--je-border-color); }
  `]
})
export class VerificationsPage implements ViewWillEnter {
  private supportService = inject(SupportService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly tab = signal<'vendors' | 'packages'>('vendors');
  readonly vendors = signal<Record<string, unknown>[]>([]);
  readonly packages = signal<Record<string, unknown>[]>([]);

  ionViewWillEnter(): void {
    this.load();
  }

  switchTab(tab: 'vendors' | 'packages'): void {
    this.tab.set(tab);
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    // Both queues load together so the tab counts are accurate from the start.
    this.supportService.getPendingVendors().subscribe(vendors => {
      this.vendors.set(vendors);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
    this.supportService.getPendingPackages().subscribe(packages => this.packages.set(packages));
  }

  async approveVendor(vendor: Record<string, unknown>): Promise<void> {
    const confirmed = await this.toast.confirm(
      'Approve this vendor?',
      `${vendor['businessName'] || vendor['name']} will be able to list packages and take bookings.`,
      'Approve'
    );
    if (!confirmed) return;

    this.supportService.verifyVendor(String(vendor['id']), 'verified').subscribe(success =>
      this.report(success, 'Vendor verified.')
    );
  }

  async rejectVendor(vendor: Record<string, unknown>): Promise<void> {
    const remarks = await this.toast.prompt('Reject this vendor', 'Tell them what needs fixing', 'Reject');
    if (!remarks) return;

    this.supportService.verifyVendor(String(vendor['id']), 'rejected', remarks).subscribe(success =>
      this.report(success, 'Vendor rejected with feedback.')
    );
  }

  async approvePackage(pkg: Record<string, unknown>): Promise<void> {
    this.supportService.verifyPackage(String(pkg['id']), 'approved').subscribe(success =>
      this.report(success, 'Package is now live.')
    );
  }

  async rejectPackage(pkg: Record<string, unknown>): Promise<void> {
    const comment = await this.toast.prompt('Reject this package', 'What needs to change?', 'Reject');
    if (!comment) return;

    this.supportService.verifyPackage(String(pkg['id']), 'rejected', comment).subscribe(success =>
      this.report(success, 'Package rejected with feedback.')
    );
  }

  async openDocument(url: string | undefined): Promise<void> {
    if (!url) return;
    await Browser.open({ url }).catch(() => void 0);
  }

  private report(success: boolean, message: string): void {
    if (!success) {
      void this.toast.error('That action did not go through. Please try again.');
      return;
    }
    void this.toast.success(message);
    this.load();
  }

  initials(name: string | undefined): string {
    return (name ?? '?').split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }
}
