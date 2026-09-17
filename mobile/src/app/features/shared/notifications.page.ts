import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonItemSliding, IonItemOptions, IonItemOption, IonList, IonItem, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { NotificationService, NotificationItem } from '../../core/services/notification.service';
import { PushService } from '../../core/services/push.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * In-app notification inbox, shared by every role. Opening it clears the OS
 * badge so the tray and the app agree on what has been seen.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    TimeAgoPipe, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonItemSliding, IonItemOptions, IonItemOption, IonList, IonItem, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/" text="" />
        </ion-buttons>
        <ion-title>Notifications</ion-title>
        <ion-buttons slot="end">
          @if (notifications.unreadCount() > 0) {
            <ion-button (click)="markAll()">Mark all read</ion-button>
          }
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      @if (!notifications.items().length) {
        <app-empty-state
          icon="notifications-off-outline"
          title="You're all caught up"
          message="Booking updates, messages and payment alerts will land here." />
      } @else {
        <ion-list [inset]="false" class="list">
          @for (item of notifications.items(); track item.id) {
            <ion-item-sliding>
              <ion-item lines="full" class="row" [class.row--unread]="!item.isRead"
                        button [detail]="false" (click)="open(item)">
                <span class="icon" slot="start"
                      [style.background]="notifications.meta(item.type).color + '1F'"
                      [style.color]="notifications.meta(item.type).color">
                  <ion-icon [name]="notifications.meta(item.type).icon" />
                </span>
                <div class="body">
                  <strong class="je-sm">{{ item.title }}</strong>
                  <span class="je-xs je-muted je-clamp-2">{{ item.body }}</span>
                  <span class="je-xs je-soft">{{ item.createdAt | timeAgo }}</span>
                </div>
                @if (!item.isRead) { <span class="unread" slot="end"></span> }
              </ion-item>

              <ion-item-options side="end">
                <ion-item-option color="danger" (click)="remove(item)">
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
    .list { background: transparent; padding-top: 6px; }
    .row { --background: var(--je-bg-card); --padding-start: 14px; --inner-padding-end: 14px; }
    .row--unread { --background: rgba(255, 107, 53, 0.04); }
    .icon { width: 38px; height: 38px; display: grid; place-items: center;
            border-radius: 50%; margin-right: 14px; }
    .icon ion-icon { font-size: 17px; }
    .body { display: flex; flex-direction: column; gap: 3px; padding: 11px 0; min-width: 0; }
    .unread { width: 8px; height: 8px; border-radius: 50%; background: var(--je-primary); }
  `]
})
export class NotificationsPage implements ViewWillEnter {
  notifications = inject(NotificationService);
  private push = inject(PushService);
  private router = inject(Router);

  ionViewWillEnter(): void {
    this.notifications.fetch().subscribe();
    void this.push.clearDelivered();
  }

  refresh(event: CustomEvent): void {
    this.notifications.fetch().subscribe(() =>
      void (event.target as HTMLIonRefresherElement).complete()
    );
  }

  open(item: NotificationItem): void {
    if (!item.isRead) this.notifications.markAsRead(item.id).subscribe();
    if (item.link) void this.router.navigateByUrl(item.link);
  }

  markAll(): void {
    this.notifications.markAllAsRead().subscribe();
  }

  remove(item: NotificationItem): void {
    this.notifications.remove(item.id).subscribe();
  }
}
