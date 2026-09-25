import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonModal, IonItem, IonInput, IonTextarea, IonSpinner, IonAccordion, IonAccordionGroup, IonLabel
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { SupportService, SupportTicket } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

const FAQS = [
  { q: 'When is my advance refunded?', a: 'Cancel 30 or more days before the event and the advance is refunded in full. Inside 30 days a cancellation fee applies on a sliding scale, shown to you before you confirm.' },
  { q: 'How does escrow protect me?', a: 'Your advance is held by JoinEvents, not the vendor. It is released only after your event is marked complete, so a vendor who does not show up is never paid.' },
  { q: 'What if the vendor cancels?', a: 'You receive a full refund and we help you find a replacement. The vendor is penalised and repeated cancellations remove them from the platform.' },
  { q: 'How do I earn reward points?', a: 'You earn 10 points for every ₹100 you pay on a booking. Your balance and history are on the Rewards screen.' },
  { q: 'Can I change my event date?', a: 'Message the vendor to agree a new date. Once they confirm, our support team updates the booking for you.' }
];

/** Help centre: FAQs plus the customer's own support tickets. */
@Component({
  selector: 'app-customer-support',
  standalone: true,
  imports: [
    ReactiveFormsModule, TimeAgoPipe, StatusPillComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonModal, IonItem, IonInput, IonTextarea, IonSpinner, IonAccordion, IonAccordionGroup, IonLabel
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/profile" text="" />
        </ion-buttons>
        <ion-title>Help &amp; support</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <ion-button expand="block" class="je-btn-gradient raise" (click)="composeOpen.set(true)">
          <ion-icon slot="start" name="create-outline" /> Raise a ticket
        </ion-button>

        <!-- FAQs ------------------------------------------------------- -->
        <div class="je-section-head"><h2>Common questions</h2></div>
        <ion-accordion-group class="je-card je-card--flush">
          @for (faq of faqs; track faq.q) {
            <ion-accordion [value]="faq.q">
              <ion-item slot="header" lines="none"><ion-label class="je-sm">{{ faq.q }}</ion-label></ion-item>
              <div slot="content" class="answer">{{ faq.a }}</div>
            </ion-accordion>
          }
        </ion-accordion-group>

        <!-- Tickets ------------------------------------------------------- -->
        <div class="je-section-head"><h2>Your tickets</h2></div>
        @if (loading()) {
          <div class="center"><ion-spinner name="crescent" /></div>
        } @else if (!tickets().length) {
          <app-empty-state
            icon="ticket-outline"
            title="No tickets"
            message="If something goes wrong with a booking, raise a ticket and we'll pick it up." />
        } @else {
          @for (ticket of tickets(); track ticket.id) {
            <div class="je-card ticket">
              <div class="ticket__head">
                <strong class="je-sm je-clamp-2">{{ ticket.subject }}</strong>
                <app-status-pill [status]="ticket.status" />
              </div>
              <p class="je-xs je-muted je-clamp-2 body">{{ ticket.description }}</p>
              <div class="ticket__foot">
                <span class="je-xs je-soft">{{ ticket.createdAt | timeAgo }}</span>
                @if (ticket.replies?.length) {
                  <span class="je-xs je-muted">
                    <ion-icon name="chatbubble-outline" /> {{ ticket.replies?.length }} replies
                  </span>
                }
              </div>
            </div>
          }
        }
      </div>
    </ion-content>

    <!-- Compose sheet ------------------------------------------------------ -->
    <ion-modal [isOpen]="composeOpen()" (didDismiss)="composeOpen.set(false)"
               [initialBreakpoint]="0.8" [breakpoints]="[0, 0.8]">
      <ng-template>
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>Raise a ticket</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="composeOpen.set(false)">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <form [formGroup]="form">
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="subject" placeholder="What's this about?" />
            </ion-item>
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="eventName" placeholder="Event name (optional)" />
            </ion-item>
            <ion-item class="je-field" lines="none">
              <ion-textarea formControlName="description" [rows]="6" [autoGrow]="true"
                            placeholder="Tell us what happened, with as much detail as you can." />
            </ion-item>
            <ion-button expand="block" class="je-btn-gradient" (click)="submit()" [disabled]="saving()">
              @if (saving()) { <ion-spinner name="crescent" /> } @else { Submit ticket }
            </ion-button>
          </form>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .raise { margin: 8px 0 4px; }
    .center { display: grid; place-items: center; padding: 40px 0; }
    .answer { padding: 4px 16px 16px; font-size: var(--je-fs-sm);
              color: var(--je-text-muted); line-height: 1.6; }
    .ticket__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .ticket__head strong { flex: 1; min-width: 0; }
    .body { margin: 10px 0 0; line-height: 1.55; }
    .ticket__foot { display: flex; align-items: center; justify-content: space-between;
                    margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--je-border-color); }
    .ticket__foot span { display: inline-flex; align-items: center; gap: 5px; }
  `]
})
export class CustomerSupportPage implements ViewWillEnter {
  private fb = inject(FormBuilder);
  private supportService = inject(SupportService);
  private toast = inject(ToastService);

  readonly faqs = FAQS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly composeOpen = signal(false);
  readonly tickets = signal<SupportTicket[]>([]);

  readonly form = this.fb.nonNullable.group({
    subject: ['', Validators.required],
    eventName: [''],
    description: ['', [Validators.required, Validators.minLength(10)]]
  });

  ionViewWillEnter(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.supportService.getMyTickets().subscribe(tickets => {
      this.tickets.set(tickets);
      this.loading.set(false);
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.toast.error('Add a subject and describe the problem.');
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();

    this.supportService
      .createTicket({
        subject: value.subject,
        description: value.description,
        eventName: value.eventName || undefined
      })
      .subscribe(ticket => {
        this.saving.set(false);
        if (!ticket) {
          void this.toast.error('We could not raise the ticket. Please try again.');
          return;
        }
        this.composeOpen.set(false);
        this.form.reset();
        void this.toast.success('Ticket raised — we usually reply within a few hours.');
        this.load();
      });
  }
}
