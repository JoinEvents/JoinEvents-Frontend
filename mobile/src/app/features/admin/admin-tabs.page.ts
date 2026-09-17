import { Component, inject, OnInit } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-admin-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard">
          <ion-icon name="speedometer" />
          <ion-label>Overview</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="bookings">
          <ion-icon name="journal" />
          <ion-label>Bookings</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="directory">
          <ion-icon name="people" />
          <ion-label>Directory</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="catalogue">
          <ion-icon name="pricetags" />
          <ion-label>Catalogue</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="more">
          <ion-icon name="ellipsis-horizontal" />
          <ion-label>More</ion-label>
          @if (notifications.unreadCount() > 0) {
            <ion-badge color="danger">{{ notifications.unreadCount() }}</ion-badge>
          }
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `
})
export class AdminTabsPage implements OnInit {
  notifications = inject(NotificationService);

  ngOnInit(): void {
    this.notifications.fetch().subscribe();
  }
}
