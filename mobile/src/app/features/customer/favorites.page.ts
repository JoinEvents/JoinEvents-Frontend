import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
  IonItemSliding, IonItemOptions, IonItemOption, IonList, IonItem
} from '@ionic/angular/standalone';

import { FavoritesService } from '../../core/services/favorites.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** Saved packages, with swipe-to-remove — the native idiom for a list like this. */
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [
    RouterLink, CurrencyInrPipe, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
    IonItemSliding, IonItemOptions, IonItemOption, IonList, IonItem
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/dashboard" text="" />
        </ion-buttons>
        <ion-title>Saved</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (!favorites.count()) {
        <app-empty-state
          icon="heart-outline"
          title="Nothing saved yet"
          message="Tap the heart on any package to keep it here for later."
          actionLabel="Browse packages"
          (action)="browse()" />
      } @else {
        <ion-list [inset]="false" class="list">
          @for (item of favorites.items(); track item.id) {
            <ion-item-sliding>
              <ion-item [routerLink]="item.routeUrl" [detail]="false" lines="full" class="row">
                @if (item.image) {
                  <img [src]="item.image" [alt]="item.name" slot="start" class="thumb" />
                } @else {
                  <div slot="start" class="thumb thumb--blank"><ion-icon name="image-outline" /></div>
                }
                <div class="body">
                  <strong class="je-sm je-clamp-2">{{ item.name }}</strong>
                  @if (item.vendorName) { <span class="je-xs je-muted je-truncate">{{ item.vendorName }}</span> }
                  @if (item.price) { <span class="je-price je-sm">{{ item.price | inr }}</span> }
                </div>
              </ion-item>

              <ion-item-options side="end">
                <ion-item-option color="danger" (click)="favorites.remove(item.id)">
                  <ion-icon slot="icon-only" name="trash-outline" />
                </ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`
    .list { background: transparent; padding-top: 8px; }
    .row { --background: var(--je-bg-card); --padding-start: 14px; --inner-padding-end: 14px; }
    .thumb { width: 58px; height: 58px; border-radius: var(--je-radius-sm);
             object-fit: cover; margin-right: 14px; }
    .thumb--blank { display: grid; place-items: center; background: var(--je-bg-light); }
    .thumb--blank ion-icon { font-size: 22px; color: var(--je-text-soft); }
    .body { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px 0; }
  `]
})
export class FavoritesPage {
  favorites = inject(FavoritesService);
  private router = inject(Router);

  browse(): void {
    void this.router.navigate(['/customer/tabs/events']);
  }
}
