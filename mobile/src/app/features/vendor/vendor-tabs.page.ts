import { Component, inject, OnInit } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { NotificationService } from '../../core/services/notification.service';
import { MessengerService } from '../../core/services/messenger.service';

@Component({
  selector: 'app-vendor-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard">
          <ion-icon name="stats-chart" />
          <ion-label>Overview</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="bookings">
          <ion-icon name="journal" />
          <ion-label>Bookings</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="packages">
          <ion-icon name="cube" />
          <ion-label>Packages</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="quote-board">
          <ion-icon name="megaphone" />
          <ion-label>Leads</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="more">
          <ion-icon name="ellipsis-horizontal" />
          <ion-label>More</ion-label>
          @if (badgeCount() > 0) { <ion-badge color="danger">{{ badgeCount() }}</ion-badge> }
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `
})
export class VendorTabsPage implements OnInit {
  private notifications = inject(NotificationService);
  private messenger = inject(MessengerService);

  ngOnInit(): void {
    this.notifications.fetch().subscribe();
    this.messenger.getThreads().subscribe();
  }

  /** Messages and notifications both live under More, so the badge sums them. */
  badgeCount(): number {
    return this.notifications.unreadCount() + this.messenger.totalUnread();
  }
}
