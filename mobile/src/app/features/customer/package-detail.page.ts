import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonButton, IonIcon,
  IonSpinner, IonAccordion, IonAccordionGroup, IonItem, IonLabel, IonChip
} from '@ionic/angular/standalone';

import { PackageService } from '../../core/services/package.service';
import { ReviewService, Review } from '../../core/services/review.service';
import { MessengerService } from '../../core/services/messenger.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { EventPackage, PackageServiceDetail } from '../../core/models/event.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { JoinPartsPipe } from '../../shared/pipes/join-parts.pipe';

/**
 * Package detail with a swipeable gallery, inclusions, policies, reviews and a
 * sticky book bar. The bar stays pinned because price and the primary action
 * are what the user scrolls back up to find.
 */
/** Catering priced under this is a per-plate rate, charged per guest (as the API prices it). */
const PER_PLATE_THRESHOLD = 5000;

@Component({
  selector: 'app-package-detail',
  standalone: true,
  imports: [
    DecimalPipe, TitleCasePipe, CurrencyInrPipe, TimeAgoPipe, JoinPartsPipe,
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonButton, IonIcon,
    IonSpinner, IonAccordion, IonAccordionGroup, IonItem, IonLabel, IonChip
  ],
  template: `
    <ion-header class="ion-no-border" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/events" text="" />
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button (click)="toggleFavorite()">
            <ion-icon slot="icon-only"
                      [name]="isFavorite() ? 'heart' : 'heart-outline'"
                      [color]="isFavorite() ? 'danger' : undefined" />
          </ion-button>
          <ion-button (click)="share()">
            <ion-icon slot="icon-only" name="share-social-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent" /></div>
      } @else if (pkg(); as p) {
        <!-- Gallery ------------------------------------------------------ -->
        <div class="gallery">
          @if (gallery().length) {
            <div class="gallery__track">
              @for (image of gallery(); track image) {
                <img [src]="image" [alt]="p.name" loading="lazy" />
              }
            </div>
            @if (gallery().length > 1) {
              <span class="gallery__count">{{ gallery().length }} photos</span>
            }
          } @else {
            <div class="gallery__blank"><ion-icon name="image-outline" /></div>
          }
        </div>

        <div class="je-section">
          <!-- Title block ------------------------------------------------ -->
          <div class="title">
            <h1>{{ p.name }}</h1>
            <div class="title__meta">
              @if (p.rating) {
                <span class="rating"><ion-icon name="star" /> {{ p.rating | number: '1.1-1' }}</span>
                <span class="je-xs je-soft">({{ p.totalReviews || 0 }} reviews)</span>
              }
              @if (p.tier) { <ion-chip class="tier">{{ p.tier | titlecase }}</ion-chip> }
            </div>
            @if (p.address?.city) {
              <p class="je-sm je-muted loc">
                <ion-icon name="location-outline" />
                {{ [p.address?.locality, p.address?.city, p.address?.state] | joinParts }}
              </p>
            }
          </div>

          <!-- Vendor ------------------------------------------------------ -->
          @if (p.vendorName) {
            <div class="je-card vendor">
              <div class="vendor__avatar">{{ initials(p.vendorName) }}</div>
              <div class="vendor__body">
                <strong>{{ p.vendorName }}</strong>
                @if (p.experience) { <span class="je-xs je-muted">{{ p.experience }} years experience</span> }
              </div>
              <ion-button size="small" fill="outline" (click)="messageVendor()">
                <ion-icon slot="start" name="chatbubble-outline" /> Chat
              </ion-button>
            </div>
          }

          <!-- Key facts ---------------------------------------------------- -->
          <div class="je-grid-3 facts">
            @if (p.maxGuests) {
              <div class="je-stat">
                <div class="je-stat__value">{{ p.maxGuests }}</div>
                <div class="je-stat__label">Max guests</div>
              </div>
            }
            @if (p.durationHours) {
              <div class="je-stat">
                <div class="je-stat__value">{{ p.durationHours }}h</div>
                <div class="je-stat__label">Duration</div>
              </div>
            }
            @if (p.capacity?.parkingCapacity) {
              <div class="je-stat">
                <div class="je-stat__value">{{ p.capacity?.parkingCapacity }}</div>
                <div class="je-stat__label">Parking</div>
              </div>
            }
          </div>

          <!-- Description --------------------------------------------------- -->
          @if (p.description) {
            <div class="je-section-head"><h2>About this package</h2></div>
            <p class="desc" [class.desc--clamped]="!descriptionOpen()">{{ p.description }}</p>
            @if (p.description.length > 180) {
              <button class="more" (click)="descriptionOpen.set(!descriptionOpen())">
                {{ descriptionOpen() ? 'Show less' : 'Read more' }}
              </button>
            }
          }

          <!-- What's included: each service as the vendor described it ------- -->
          @if (p.services.length) {
            <div class="je-section-head"><h2>What's included</h2></div>
            <ion-accordion-group class="je-card je-card--flush" [multiple]="true">
              @for (service of p.services; track service) {
                @if (p.serviceDetails?.[service]; as d) {
                  <ion-accordion [value]="service">
                    <ion-item slot="header" lines="none">
                      <ion-icon name="checkmark-circle" color="success" slot="start" />
                      <ion-label>
                        <span class="je-sm svc-name">{{ service }}</span>
                        @if (servicePrice(service, d); as price) { <p class="je-xs je-muted">{{ price }}</p> }
                      </ion-label>
                    </ion-item>
                    <div slot="content" class="svc">
                      @if (d.images.length) {
                        <div class="svc__photos">
                          @for (image of d.images; track image) { <img [src]="image" [alt]="service" loading="lazy" /> }
                        </div>
                      }
                      @if (d.description) { <p class="je-sm je-muted svc__desc">{{ d.description }}</p> }
                      @if (d.keyFeatures.length) {
                        <strong class="je-xs svc__label">Highlights</strong>
                        <ul class="svc__list">@for (f of d.keyFeatures; track f) { <li class="je-sm">{{ f }}</li> }</ul>
                      }
                      @if (d.inclusions.length) {
                        <strong class="je-xs svc__label">Includes</strong>
                        <ul class="svc__list">@for (i of d.inclusions; track i) { <li class="je-sm">{{ i }}</li> }</ul>
                      }
                      @if (!d.description && !d.keyFeatures.length && !d.inclusions.length && !d.images.length) {
                        <p class="je-xs je-soft svc__desc">The vendor has not added more details for this service.</p>
                      }
                    </div>
                  </ion-accordion>
                } @else {
                  <div class="inc">
                    <ion-icon name="checkmark-circle" color="success" />
                    <span class="je-sm">{{ service }}</span>
                  </div>
                }
              }
            </ion-accordion-group>
          }

          <!-- Food and venue facilities --------------------------------------- -->
          @if (facilities().length) {
            <div class="je-section-head"><h2>Food &amp; facilities</h2></div>
            <div class="je-card">
              @for (fact of facilities(); track fact) {
                <div class="inc">
                  <ion-icon name="information-circle-outline" color="medium" />
                  <span class="je-sm">{{ fact }}</span>
                </div>
              }
            </div>
          }

          <!-- Policies --------------------------------------------------------- -->
          @if (hasPolicies()) {
            <div class="je-section-head"><h2>Policies</h2></div>
            <ion-accordion-group class="je-card je-card--flush">
              @if (p.policies?.cateringPolicy) {
                <ion-accordion value="catering">
                  <ion-item slot="header" lines="none"><ion-label>Catering</ion-label></ion-item>
                  <div slot="content" class="pol">{{ p.policies?.cateringPolicy }}</div>
                </ion-accordion>
              }
              @if (p.policies?.decorPolicy) {
                <ion-accordion value="decor">
                  <ion-item slot="header" lines="none"><ion-label>Decor</ion-label></ion-item>
                  <div slot="content" class="pol">{{ p.policies?.decorPolicy }}</div>
                </ion-accordion>
              }
              @if (p.policies?.alcoholPolicy) {
                <ion-accordion value="alcohol">
                  <ion-item slot="header" lines="none"><ion-label>Alcohol</ion-label></ion-item>
                  <div slot="content" class="pol">{{ p.policies?.alcoholPolicy }}</div>
                </ion-accordion>
              }
              @if (p.policies?.djPolicy) {
                <ion-accordion value="dj">
                  <ion-item slot="header" lines="none"><ion-label>Music &amp; DJ</ion-label></ion-item>
                  <div slot="content" class="pol">{{ p.policies?.djPolicy }}</div>
                </ion-accordion>
              }
            </ion-accordion-group>
          }

          <!-- Reviews ------------------------------------------------------------ -->
          @if (reviews().length) {
            <div class="je-section-head"><h2>Reviews</h2></div>
            @for (review of reviews().slice(0, 5); track review.id) {
              <div class="je-card review">
                <div class="review__head">
                  <strong class="je-sm">{{ review.customerName }}</strong>
                  <span class="je-xs je-soft">{{ review.createdAt | timeAgo }}</span>
                </div>
                <div class="stars">
                  @for (star of [1,2,3,4,5]; track star) {
                    <ion-icon [name]="star <= review.rating ? 'star' : 'star-outline'" />
                  }
                </div>
                <p class="je-sm je-muted">{{ review.comment }}</p>
              </div>
            }
          }
        </div>

        <!-- Sticky book bar ------------------------------------------------------ -->
        <div class="je-action-bar">
          <div class="bar__price">
            <span class="je-xs je-soft">{{ p.maxGuests ? 'For ' + p.maxGuests + ' guests, incl. GST' : 'Incl. GST' }}</span>
            <strong class="je-price">{{ p.price | inr }}</strong>
          </div>
          <ion-button class="je-btn-gradient bar__cta" (click)="book()">Book now</ion-button>
        </div>
      } @else {
        <div class="je-empty">
          <ion-icon name="alert-circle-outline" />
          <h3>Package unavailable</h3>
          <p>It may have been removed or is no longer accepting bookings.</p>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }

    .gallery { position: relative; }
    .gallery__track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
    .gallery__track::-webkit-scrollbar { display: none; }
    .gallery__track img { width: 100%; height: 260px; flex: 0 0 100%; object-fit: cover; scroll-snap-align: center; }
    .gallery__blank { height: 220px; display: grid; place-items: center; background: var(--je-bg-light); }
    .gallery__blank ion-icon { font-size: 40px; color: var(--je-text-soft); }
    .gallery__count { position: absolute; bottom: 12px; right: 14px; padding: 4px 10px;
                      border-radius: var(--je-radius-full); background: rgba(0,0,0,0.6);
                      color: #fff; font-size: var(--je-fs-xs); font-weight: 600; }

    .title { margin: 18px 0 16px; }
    .title h1 { font-size: var(--je-fs-xl); margin: 0 0 8px; line-height: 1.3; }
    .title__meta { display: flex; align-items: center; gap: 8px; }
    .rating { display: flex; align-items: center; gap: 4px; font-size: var(--je-fs-sm); font-weight: 700; }
    .rating ion-icon { color: var(--je-accent); font-size: 14px; }
    .tier { --background: var(--je-bg-light); --color: var(--je-text-muted); font-size: var(--je-fs-xs);
            font-weight: 600; height: 22px; }
    .loc { display: flex; align-items: center; gap: 5px; margin: 8px 0 0; }

    .vendor { display: flex; align-items: center; gap: 12px; }
    .vendor__avatar { width: 42px; height: 42px; flex-shrink: 0; display: grid; place-items: center;
                      border-radius: 50%; background: var(--je-gradient-secondary); color: #fff;
                      font-weight: 700; font-size: var(--je-fs-sm); }
    .vendor__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .vendor__body strong { font-size: var(--je-fs-base); }

    .facts { margin-bottom: 4px; }

    .desc { font-size: var(--je-fs-sm); color: var(--je-text-muted); line-height: 1.6; margin: 0; }
    .desc--clamped { display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4;
                     -webkit-box-orient: vertical; overflow: hidden; }
    .more { background: none; border: none; padding: 8px 0 0; color: var(--je-primary);
            font-size: var(--je-fs-sm); font-weight: 600; }

    .inc { display: flex; align-items: center; gap: 10px; padding: 7px 0; }
    ion-accordion-group .inc { padding: 10px 16px; }
    .svc-name { font-weight: 600; }
    .svc { padding: 0 16px 14px; }
    .svc__photos { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 10px; scrollbar-width: none; }
    .svc__photos img { width: 120px; height: 84px; flex-shrink: 0; border-radius: var(--je-radius-sm); object-fit: cover; }
    .svc__desc { margin: 0 0 10px; line-height: 1.55; }
    .svc__label { display: block; margin: 6px 0 2px; color: var(--je-text-muted); }
    .svc__list { margin: 0 0 6px; padding-left: 18px; }
    .svc__list li { line-height: 1.6; }
    .inc ion-icon { font-size: 17px; flex-shrink: 0; }

    .addon { display: flex; align-items: center; justify-content: space-between; padding: 8px 0;
             border-bottom: 1px solid var(--je-border-color); }
    .addon:last-child { border-bottom: none; }

    .pol { padding: 4px 16px 16px; font-size: var(--je-fs-sm); color: var(--je-text-muted); line-height: 1.55; }

    .review__head { display: flex; align-items: center; justify-content: space-between; }
    .stars { display: flex; gap: 2px; margin: 6px 0 8px; }
    .stars ion-icon { font-size: 13px; color: var(--je-accent); }
    .review p { margin: 0; line-height: 1.55; }

    .bar__price { display: flex; flex-direction: column; line-height: 1.25; }
    .bar__price .je-price { font-size: var(--je-fs-md); }
    .bar__cta { flex: 1; margin: 0; }
  `]
})
export class PackageDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private packageService = inject(PackageService);
  private reviewService = inject(ReviewService);
  private messenger = inject(MessengerService);
  private favorites = inject(FavoritesService);
  private shareService = inject(ShareService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly pkg = signal<EventPackage | null>(null);
  readonly reviews = signal<Review[]>([]);
  readonly descriptionOpen = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.packageService.getById(id).subscribe(pkg => {
      this.pkg.set(pkg);
      this.loading.set(false);
      if (pkg?.vendorId) {
        this.reviewService.getByVendor(pkg.vendorId).subscribe(list => this.reviews.set(list));
      }
    });
  }

  gallery(): string[] {
    const pkg = this.pkg();
    if (!pkg) return [];
    const images = [...(pkg.images ?? [])];
    if (pkg.image && !images.includes(pkg.image)) images.unshift(pkg.image);
    for (const detail of Object.values(pkg.serviceDetails ?? {})) {
      for (const image of detail.images) if (!images.includes(image)) images.push(image);
    }
    return images;
  }

  /** A service's price as the vendor set it; catering at a plate rate is per plate. */
  servicePrice(name: string, detail: PackageServiceDetail): string {
    if (!detail.minPrice) return '';
    const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    const perPlate = name.toLowerCase().includes('catering') && detail.minPrice < PER_PLATE_THRESHOLD;
    const range = detail.maxPrice > detail.minPrice ? `${money(detail.minPrice)} – ${money(detail.maxPrice)}` : money(detail.minPrice);
    return `${range}${perPlate ? ' per plate' : ''} + GST`;
  }

  /** Cuisine, rooms and amenities the vendor recorded on the package. */
  facilities(): string[] {
    const pkg = this.pkg();
    if (!pkg) return [];
    const facts: string[] = [];
    if (pkg.pricing?.cuisine) facts.push(`Cuisine: ${pkg.pricing.cuisine}`);
    const food = { veg: 'Veg', nonveg: 'Non-veg', mixed: 'Veg & non-veg' }[pkg.pricing?.cuisineType ?? ''];
    if (food) facts.push(`Food: ${food}`);
    if (pkg.capacity?.totalRooms) facts.push(`${pkg.capacity.totalRooms} rooms`);
    if (pkg.amenities?.hasAc) facts.push('Air conditioning');
    if (pkg.amenities?.hasPowerBackup) facts.push('Power backup');
    if (pkg.amenities?.hasChangingRooms) facts.push('Changing rooms');
    if (pkg.amenities?.hasParking) facts.push('Parking');
    return facts;
  }

  hasPolicies(): boolean {
    const policies = this.pkg()?.policies;
    return !!policies && Object.values(policies).some(Boolean);
  }

  isFavorite(): boolean {
    const id = this.pkg()?.id;
    return !!id && this.favorites.isFavorite(id);
  }

  toggleFavorite(): void {
    const pkg = this.pkg();
    if (!pkg) return;
    const added = this.favorites.toggle({
      id: pkg.id,
      name: pkg.name,
      image: pkg.image,
      price: pkg.price,
      vendorName: pkg.vendorName,
      routeUrl: `/customer/package/${pkg.id}`
    });
    void this.toast.success(added ? 'Saved to your list' : 'Removed from your list');
  }

  async share(): Promise<void> {
    const pkg = this.pkg();
    if (pkg) await this.shareService.sharePackage(pkg.name, pkg.id, pkg.price);
  }

  messageVendor(): void {
    const pkg = this.pkg();
    if (!pkg?.vendorId) return;

    this.messenger.requestChat(pkg.vendorId, null, `Hi, I'm interested in "${pkg.name}".`).subscribe(result => {
      if (!result?.threadId) {
        void this.toast.error('Could not start the conversation. Please try again.');
        return;
      }
      void this.router.navigate(['/customer/chat', result.threadId]);
    });
  }

  book(): void {
    const pkg = this.pkg();
    if (pkg) void this.router.navigate(['/customer/book', pkg.id]);
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }
}
