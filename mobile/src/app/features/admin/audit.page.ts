import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSearchbar,
  IonIcon, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { AdminService } from '../../core/services/admin.service';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** Immutable record of who changed what, filterable by actor or action. */
@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [
    DatePipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSearchbar,
    IonIcon, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/admin/tabs/dashboard" text="" />
        </ion-buttons>
        <ion-title>Audit trail</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Filter by actor, action or entity" [debounce]="300"
                       (ionInput)="query.set($any($event.target).value ?? '')" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="6" />
        } @else if (!visible().length) {
          <app-empty-state icon="receipt-outline" title="Nothing logged"
                           message="No audit entries match this filter." />
        } @else {
          @for (log of visible(); track $index) {
            <div class="je-card entry">
              <span class="entry__icon"><ion-icon [name]="iconFor($any(log['action']))" /></span>
              <div class="entry__body">
                <strong class="je-sm">{{ log['action'] || log['description'] }}</strong>
                @if (log['entityType']) {
                  <span class="je-xs je-muted">
                    {{ log['entityType'] }}
                    @if (log['entityId']) { · {{ $any(log['entityId']).toString().slice(0, 8) }} }
                  </span>
                }
                <span class="je-xs je-soft">
                  {{ log['actor'] || log['userName'] || 'System' }} ·
                  {{ $any(log['timestamp'] || log['createdAt']) | date: 'd MMM y, h:mm a' }}
                </span>
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .entry { display: flex; gap: 12px; align-items: flex-start; }
    .entry__icon { width: 34px; height: 34px; flex-shrink: 0; display: grid; place-items: center;
                   border-radius: 50%; background: var(--je-bg-light); color: var(--je-text-muted); }
    .entry__icon ion-icon { font-size: 15px; }
    .entry__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  `]
})
export class AdminAuditPage implements ViewWillEnter {
  private adminService = inject(AdminService);

  readonly loading = signal(true);
  readonly logs = signal<Record<string, unknown>[]>([]);
  readonly query = signal('');

  readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.logs();
    return this.logs().filter(log =>
      JSON.stringify(log).toLowerCase().includes(term)
    );
  });

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    this.adminService.getAuditLogs().subscribe(logs => {
      this.logs.set(logs);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  /** A glanceable icon per action family — create, delete, approve, and so on. */
  iconFor(action: string | undefined): string {
    const value = (action ?? '').toLowerCase();
    if (value.includes('delete') || value.includes('remove')) return 'trash-outline';
    if (value.includes('create') || value.includes('add')) return 'add-circle-outline';
    if (value.includes('update') || value.includes('edit')) return 'create-outline';
    if (value.includes('verify') || value.includes('approve')) return 'shield-checkmark-outline';
    if (value.includes('reject') || value.includes('decline')) return 'close-circle-outline';
    if (value.includes('login') || value.includes('auth')) return 'log-in-outline';
    if (value.includes('payment') || value.includes('refund')) return 'card-outline';
    return 'ellipse-outline';
  }
}
