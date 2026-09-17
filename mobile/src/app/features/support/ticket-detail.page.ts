import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonSpinner, IonTextarea, IonFooter, IonItem, IonSelect, IonSelectOption, IonCheckbox, IonLabel
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { SupportService, SupportTicket } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

/**
 * Ticket thread with the agent's reply box. Internal notes are visually
 * distinct from customer-visible replies — mixing them up is the failure mode
 * that matters most here.
 */
@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    DatePipe, StatusPillComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonSpinner, IonTextarea, IonFooter, IonItem, IonSelect, IonSelectOption, IonCheckbox, IonLabel
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/support/tabs/tickets" text="" />
        </ion-buttons>
        <ion-title>Ticket</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent" /></div>
      } @else if (ticket(); as t) {
        <div class="je-section">
          <div class="je-card head">
            <div class="head__top">
              <span class="je-xs je-soft">{{ t.ticketNumber || t.id.slice(0, 8) }}</span>
              <app-status-pill [status]="t.status" />
            </div>
            <h1>{{ t.subject }}</h1>
            @if (t.customerName) {
              <p class="meta"><ion-icon name="person-outline" /> {{ t.customerName }}</p>
            }
            @if (t.eventName) {
              <p class="meta"><ion-icon name="sparkles-outline" /> {{ t.eventName }}</p>
            }
            <p class="meta"><ion-icon name="time-outline" /> Raised {{ t.createdAt | date: 'd MMM y, h:mm a' }}</p>
          </div>

          <!-- Triage controls ------------------------------------------ -->
          <div class="je-card triage">
            <ion-item lines="none" class="triage__item">
              <ion-label class="je-sm">Status</ion-label>
              <ion-select slot="end" [value]="t.status" interface="action-sheet"
                          (ionChange)="setStatus($any($event.detail.value))">
                <ion-select-option value="open">Open</ion-select-option>
                <ion-select-option value="in_progress">In progress</ion-select-option>
                <ion-select-option value="resolved">Resolved</ion-select-option>
                <ion-select-option value="closed">Closed</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item lines="none" class="triage__item">
              <ion-label class="je-sm">Priority</ion-label>
              <ion-select slot="end" [value]="t.priority" interface="action-sheet"
                          (ionChange)="setPriority($any($event.detail.value))">
                <ion-select-option value="low">Low</ion-select-option>
                <ion-select-option value="medium">Medium</ion-select-option>
                <ion-select-option value="high">High</ion-select-option>
                <ion-select-option value="urgent">Urgent</ion-select-option>
              </ion-select>
            </ion-item>
          </div>

          <!-- Thread ------------------------------------------------------ -->
          <div class="je-section-head"><h2>Conversation</h2></div>

          <div class="je-card msg msg--customer">
            <div class="msg__head">
              <strong class="je-xs">{{ t.customerName || 'Customer' }}</strong>
              <span class="je-xs je-soft">{{ t.createdAt | date: 'd MMM, h:mm a' }}</span>
            </div>
            <p class="je-sm">{{ t.description }}</p>
            @if (t.attachmentUrl) {
              <a class="je-xs attach" [href]="t.attachmentUrl" target="_blank" rel="noopener">
                <ion-icon name="attach-outline" /> View attachment
              </a>
            }
          </div>

          @for (reply of t.replies ?? []; track reply.id) {
            <div class="je-card msg" [class.msg--internal]="reply.isInternal">
              <div class="msg__head">
                <strong class="je-xs">
                  {{ reply.author }}
                  @if (reply.isInternal) { <span class="tag">Internal</span> }
                </strong>
                <span class="je-xs je-soft">{{ reply.createdAt | date: 'd MMM, h:mm a' }}</span>
              </div>
              <p class="je-sm">{{ reply.message }}</p>
            </div>
          }
        </div>
      }
    </ion-content>

    <ion-footer class="ion-no-border">
      <ion-toolbar class="composer">
        <ion-item lines="none" class="internal">
          <ion-checkbox [checked]="internal()" labelPlacement="end" justify="start"
                        (ionChange)="internal.set($any($event.detail.checked))">
            <span class="je-xs">Internal note (not sent to the customer)</span>
          </ion-checkbox>
        </ion-item>
        <div class="composer__row">
          <ion-textarea class="input" [rows]="1" [autoGrow]="true" placeholder="Write a reply"
                        [value]="draft()" (ionInput)="draft.set($any($event.target).value)" />
          <ion-button fill="clear" (click)="send()" [disabled]="!draft().trim() || sending()">
            @if (sending()) { <ion-spinner name="dots" /> }
            @else { <ion-icon slot="icon-only" name="send" color="primary" /> }
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }
    .head__top { display: flex; align-items: center; justify-content: space-between; }
    .head h1 { font-size: var(--je-fs-lg); margin: 10px 0 12px; }
    .meta { display: flex; align-items: center; gap: 7px; margin: 0 0 6px;
            font-size: var(--je-fs-sm); color: var(--je-text-muted); }
    .triage { padding: 4px 0; }
    .triage__item { --background: transparent; --padding-start: 16px; }

    .msg__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .msg p { margin: 0; line-height: 1.6; white-space: pre-wrap; color: var(--je-text-muted); }
    .msg--customer { border-left: 3px solid var(--je-primary); }
    .msg--internal { background: rgba(217,119,6,0.06); border-left: 3px solid var(--je-warning); }
    .tag { margin-left: 6px; padding: 1px 6px; border-radius: var(--je-radius-full);
           background: rgba(217,119,6,0.16); color: var(--je-warning); font-size: 10px; }
    .attach { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px;
              color: var(--je-primary); font-weight: 600; text-decoration: none; }

    .composer { --background: var(--je-bg-card); --padding-start: 8px; --padding-end: 4px;
                padding-bottom: var(--ion-safe-area-bottom, 0px); }
    .internal { --background: transparent; --padding-start: 6px; --min-height: 34px; }
    .composer__row { display: flex; align-items: flex-end; gap: 4px; padding: 0 4px 6px; }
    .input { flex: 1; --background: var(--je-bg-light); --padding-start: 14px; --padding-end: 14px;
             --padding-top: 10px; --padding-bottom: 10px; border-radius: var(--je-radius-lg); }
  `]
})
export class TicketDetailPage implements ViewWillEnter {
  private route = inject(ActivatedRoute);
  private supportService = inject(SupportService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly ticket = signal<SupportTicket | null>(null);
  readonly draft = signal('');
  readonly internal = signal(false);

  private ticketId = '';

  ionViewWillEnter(): void {
    this.ticketId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  private load(): void {
    if (!this.ticketId) {
      this.loading.set(false);
      return;
    }
    this.supportService.getTicketById(this.ticketId).subscribe(ticket => {
      this.ticket.set(ticket);
      this.loading.set(false);
    });
  }

  send(): void {
    const message = this.draft().trim();
    if (!message) return;

    this.sending.set(true);
    const wasInternal = this.internal();
    this.draft.set('');

    this.supportService.reply(this.ticketId, message, wasInternal).subscribe(success => {
      this.sending.set(false);
      if (!success) {
        void this.toast.error('Reply not sent. Please try again.');
        this.draft.set(message);
        return;
      }
      void this.toast.success(wasInternal ? 'Internal note added.' : 'Reply sent to the customer.');
      this.load();
    });
  }

  setStatus(status: string): void {
    this.supportService.updateTicketStatus(this.ticketId, status).subscribe(success =>
      this.report(success, 'Status updated.')
    );
  }

  setPriority(priority: string): void {
    this.supportService.updateTicketStatus(this.ticketId, undefined, priority).subscribe(success =>
      this.report(success, 'Priority updated.')
    );
  }

  private report(success: boolean, message: string): void {
    if (!success) {
      void this.toast.error('Could not update the ticket.');
      return;
    }
    void this.toast.success(message);
    this.load();
  }
}
