import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonBadge, IonButton,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { MessengerService, ChatThread } from '../../core/services/messenger.service';
import { ToastService } from '../../core/services/toast.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * Vendor inbox. Incoming chat requests are answered here — accepting one is
 * what opens a lead into a conversation.
 */
@Component({
  selector: 'app-vendor-messages',
  standalone: true,
  imports: [
    RouterLink, TimeAgoPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonBadge, IonButton,
    IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/vendor/tabs/more" text="" />
        </ion-buttons>
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
            title="No conversations"
            message="When a customer messages you about a package, it lands here." />
        } @else {
          @if (pending().length) {
            <div class="je-section-head"><h2>Requests ({{ pending().length }})</h2></div>
            @for (thread of pending(); track thread.id) {
              <div class="je-card">
                <div class="row__lead">
                  <div class="avatar">{{ initials(thread.participantName) }}</div>
                  <div class="row__body">
                    <strong class="je-truncate">{{ thread.participantName }}</strong>
                    <span class="je-xs je-muted je-clamp-2">
                      {{ thread.lastMessage || 'Wants to discuss a booking' }}
                    </span>
                  </div>
                </div>
                <div class="acts">
                  <ion-button size="small" fill="outline" color="medium" (click)="reject(thread)">Decline</ion-button>
                  <ion-button size="small" class="je-btn-gradient" (click)="accept(thread)">Accept</ion-button>
                </div>
              </div>
            }
          }

          @if (active().length) {
            <div class="je-section-head"><h2>Conversations</h2></div>
            @for (thread of active(); track thread.id) {
              <a class="je-card row" [routerLink]="['/vendor/chat', thread.id]">
                <div class="row__lead">
                  <div class="avatar">{{ initials(thread.participantName) }}</div>
                  <div class="row__body">
                    <strong class="je-truncate">{{ thread.participantName }}</strong>
                    <span class="je-xs je-muted je-truncate">{{ thread.lastMessage || 'No messages yet' }}</span>
                  </div>
                </div>
                <div class="row__end">
                  <span class="je-xs je-soft">{{ thread.lastMessageAt | timeAgo }}</span>
                  @if (thread.unreadCount > 0) { <ion-badge color="danger">{{ thread.unreadCount }}</ion-badge> }
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
    .acts { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
  `]
})
export class VendorMessagesPage implements ViewWillEnter {
  private messenger = inject(MessengerService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly threads = signal<ChatThread[]>([]);

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

  pending(): ChatThread[] {
    return this.threads().filter(t => t.status === 'pending');
  }

  active(): ChatThread[] {
    return this.threads().filter(t => t.status !== 'pending');
  }

  accept(thread: ChatThread): void {
    this.messenger.accept(thread.id).subscribe(success => {
      if (!success) {
        void this.toast.error('Could not accept the request.');
        return;
      }
      void this.toast.success('Request accepted — you can now chat.');
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
