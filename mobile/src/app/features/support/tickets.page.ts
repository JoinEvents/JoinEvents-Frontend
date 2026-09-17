import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonSegment, IonSegmentButton,
  IonLabel, IonIcon, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { SupportService, SupportTicket } from '../../core/services/support.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type Filter = 'open' | 'in_progress' | 'resolved';

/** Agent ticket inbox, ordered by priority then age so nothing urgent sinks. */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [
    RouterLink, TimeAgoPipe, StatusPillComponent, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonSegment, IonSegmentButton,
    IonLabel, IonIcon, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Tickets</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Search tickets" [debounce]="300"
                       (ionInput)="query.set($any($event.target).value ?? '')" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event.detail.value))">
          <ion-segment-button value="open"><ion-label>Open</ion-label></ion-segment-button>
          <ion-segment-button value="in_progress"><ion-label>In progress</ion-label></ion-segment-button>
          <ion-segment-button value="resolved"><ion-label>Resolved</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="5" />
        } @else if (!visible().length) {
          <app-empty-state icon="ticket-outline" title="Queue is clear"
                           message="No tickets match this filter." />
        } @else {
          @for (ticket of visible(); track ticket.id) {
            <a class="je-card card" [class]="'card--' + ticket.priority"
               [routerLink]="['/support/ticket', ticket.id]">
              <div class="card__head">
                <div class="card__title">
                  <strong class="je-sm je-clamp-2">{{ ticket.subject }}</strong>
                  <span class="je-xs je-soft">
                    {{ ticket.ticketNumber || ticket.id.slice(0, 8) }}
                    @if (ticket.customerName) { · {{ ticket.customerName }} }
                  </span>
                </div>
                <div class="card__flags">
                  <span class="je-pill" [class]="priorityClass(ticket.priority)">{{ ticket.priority }}</span>
                  <app-status-pill [status]="ticket.status" />
                </div>
              </div>

              <p class="je-xs je-muted je-clamp-2 body">{{ ticket.description }}</p>

              <div class="card__foot">
                <span class="je-xs je-soft">Raised {{ ticket.createdAt | timeAgo }}</span>
                @if (ticket.replies?.length) {
                  <span class="je-xs je-muted">
                    <ion-icon name="chatbubble-outline" /> {{ ticket.replies?.length }}
                  </span>
                }
              </div>
            </a>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .card { display: block; text-decoration: none; border-left: 3px solid transparent; }
    .card--urgent { border-left-color: var(--je-danger); }
    .card--high   { border-left-color: var(--je-warning); }
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__title { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
    .card__title strong { color: var(--je-text-main); }
    .card__flags { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
    .body { margin: 10px 0 0; line-height: 1.55; }
    .card__foot { display: flex; align-items: center; justify-content: space-between;
                  margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--je-border-color); }
    .card__foot span { display: inline-flex; align-items: center; gap: 5px; }
    .p-urgent { background: rgba(220,38,38,0.12); color: var(--je-danger); }
    .p-high   { background: rgba(217,119,6,0.12); color: var(--je-warning); }
    .p-medium { background: rgba(14,165,233,0.12); color: var(--je-info); }
    .p-low    { background: var(--je-bg-light); color: var(--je-text-muted); }
  `]
})
export class SupportTicketsPage implements ViewWillEnter {
  private supportService = inject(SupportService);

  readonly loading = signal(true);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly filter = signal<Filter>('open');
  readonly query = signal('');

  private static readonly PRIORITY_ORDER: Record<string, number> = {
    urgent: 0, high: 1, medium: 2, low: 3
  };

  readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();

    return this.tickets()
      .filter(t => {
        if (this.filter() === 'resolved') return ['resolved', 'closed'].includes(t.status);
        return t.status === this.filter();
      })
      .filter(t =>
        !term ||
        t.subject.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        (t.customerName ?? '').toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const byPriority =
          (SupportTicketsPage.PRIORITY_ORDER[a.priority] ?? 9) -
          (SupportTicketsPage.PRIORITY_ORDER[b.priority] ?? 9);
        if (byPriority !== 0) return byPriority;
        // Same priority: oldest first, so nothing ages out of sight.
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  });

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.supportService.getTickets().subscribe(tickets => {
      this.tickets.set(tickets);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  priorityClass(priority: string): string {
    return `p-${priority}`;
  }
}
