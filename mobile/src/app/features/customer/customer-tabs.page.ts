import { Component, inject, OnInit } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';

import { NotificationService } from '../../core/services/notification.service';
import { MessengerService } from '../../core/services/messenger.service';

/** Bottom tab shell for the customer role. */
@Component({
  selector: 'app-customer-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard">
          <ion-icon name="home" />
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="events">
          <ion-icon name="sparkles" />
          <ion-label>Browse</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="bookings">
          <ion-icon name="journal" />
          <ion-label>Bookings</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="messages">
          <ion-icon name="chatbubbles" />
          <ion-label>Messages</ion-label>
          @if (messenger.totalUnread() > 0) {
            <ion-badge color="danger">{{ messenger.totalUnread() }}</ion-badge>
          }
        </ion-tab-button>

        <ion-tab-button tab="profile">
          <ion-icon name="person" />
          <ion-label>Profile</ion-label>
          @if (notifications.unreadCount() > 0) {
            <ion-badge color="danger">{{ notifications.unreadCount() }}</ion-badge>
          }
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `
})
export class CustomerTabsPage implements OnInit {
  notifications = inject(NotificationService);
  messenger = inject(MessengerService);

  ngOnInit(): void {
    // Prime the badges once the shell mounts; each tab refreshes its own data.
    this.notifications.fetch().subscribe();
    this.messenger.getThreads().subscribe();
  }
}
