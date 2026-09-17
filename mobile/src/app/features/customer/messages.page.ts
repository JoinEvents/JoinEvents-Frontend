import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonBadge,
  IonRefresher, IonRefresherContent, IonButton
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { MessengerService, ChatThread } from '../../core/services/messenger.service';
import { ToastService } from '../../core/services/toast.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * Conversation list. A vendor must accept a chat request before it opens, so
 * pending requests are shown with accept/decline rather than as a normal thread.
 */
@Component({
  selector: 'app-customer-messages',
  standalone: true,
  imports: [
    RouterLink, TimeAgoPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonBadge,
    IonRefresher, IonRefresherContent, IonButton
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Messages</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="5" />
        } @else if (!threads().length) {
          <app-empty-state
            icon="chatbubbles-outline"
            title="No conversations yet"
            message="Message a vendor from a package page to start talking." />
        } @else {
          @for (thread of threads(); track thread.id) {
            @if (thread.status === 'pending') {
              <div class="je-card req">
                <div class="row__lead">
                  <div class="avatar">{{ initials(thread.participantName) }}</div>
                  <div class="row__body">
                    <strong class="je-truncate">{{ thread.participantName }}</strong>
                    <span class="je-xs je-muted je-truncate">{{ thread.lastMessage || 'Wants to connect' }}</span>
                  </div>
                </div>
                <div class="req__acts">
                  <ion-button size="small" fill="outline" color="medium" (click)="reject(thread)">Decline</ion-button>
                  <ion-button size="small" class="je-btn-gradient" (click)="accept(thread)">Accept</ion-button>
                </div>
              </div>
            } @else {
              <a class="je-card row" [routerLink]="['/customer/chat', thread.id]">
                <div class="row__lead">
                  <div class="avatar">{{ initials(thread.participantName) }}</div>
                  <div class="row__body">
                    <strong class="je-truncate">{{ thread.participantName }}</strong>
                    <span class="je-xs je-muted je-truncate">{{ thread.lastMessage || 'No messages yet' }}</span>
                  </div>
                </div>
                <div class="row__end">
                  <span class="je-xs je-soft">{{ thread.lastMessageAt | timeAgo }}</span>
                  @if (thread.unreadCount > 0) {
                    <ion-badge color="danger">{{ thread.unreadCount }}</ion-badge>
                  }
                </div>
              </a>
            }
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; text-decoration: none; }
    .row__lead { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
    .avatar { width: 44px; height: 44px; flex-shrink: 0; display: grid; place-items: center;
              border-radius: 50%; background: var(--je-gradient-secondary); color: #fff;
              font-weight: 700; font-size: var(--je-fs-sm); }
    .row__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .row__body strong { font-size: var(--je-fs-base); color: var(--je-text-main); }
    .row__end { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
    .req__acts { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
  `]
})
export class CustomerMessagesPage implements ViewWillEnter {
  private messenger = inject(MessengerService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly threads = signal<ChatThread[]>([]);

  /** Refreshes each time the tab is shown, not only on first mount. */
  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.messenger.getThreads().subscribe(threads => {
      this.threads.set(threads);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  accept(thread: ChatThread): void {
    this.messenger.accept(thread.id).subscribe(success => {
      if (!success) {
        void this.toast.error('Could not accept the request.');
        return;
      }
      this.load();
    });
  }

  reject(thread: ChatThread): void {
    this.messenger.reject(thread.id).subscribe(success => {
      if (!success) {
        void this.toast.error('Could not decline the request.');
        return;
      }
      this.load();
    });
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }
}
