import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonFooter, IonTextarea
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { AssistantService, AssistantAction } from '../../core/services/assistant.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

/**
 * Roshi, the customer's event concierge. Answers come from the API using the customer's own
 * bookings, rewards and the listed packages; cards and buttons open the matching screens.
 */
@Component({
  selector: 'app-roshi',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, CurrencyInrPipe, StatusPillComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonFooter, IonTextarea
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/dashboard" text="" />
        </ion-buttons>
        <ion-title>
          <div class="title">
            <span class="title__avatar"><ion-icon name="sparkles" /></span>
            <span class="title__text">
              <strong>Roshi</strong>
              <small>Your event concierge</small>
            </span>
          </div>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="roshi.newConversation()" aria-label="New conversation">
            <ion-icon slot="icon-only" name="refresh-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content #scroller class="roshi">
      <div class="thread">
        @for (msg of roshi.messages(); track msg.id) {
          @if (msg.from === 'user') {
            <div class="msg msg--mine"><div class="bubble"><p>{{ msg.text }}</p></div></div>
          } @else {
            <div class="msg">
              <span class="avatar"><ion-icon name="sparkles" /></span>
              <div class="bubble bubble--roshi" [class.bubble--failed]="msg.failed" [innerHTML]="msg.html"></div>
            </div>
            @if (msg.failed) {
              <div class="actions"><button class="action" (click)="roshi.retry()"><ion-icon name="refresh" /> Try again</button></div>
            }

            @for (card of msg.cards ?? []; track $index) {
              @if (card.type === 'packages' && card.packages?.length) {
                <div class="rail">
                  @for (pkg of card.packages; track pkg.id) {
                    <button class="pkg" (click)="go('package:' + pkg.id)">
                      <div class="pkg__img">
                        @if (pkg.image) { <img [src]="pkg.image" [alt]="pkg.name" loading="lazy" /> }
                        @else { <ion-icon name="image-outline" /> }
                      </div>
                      <div class="pkg__body">
                        <strong class="je-truncate">{{ pkg.name }}</strong>
                        <span class="je-xs je-muted je-truncate">{{ pkg.vendorName }}@if (pkg.city) { · {{ pkg.city }} }</span>
                        <span class="pkg__foot">
                          <span class="je-price">{{ pkg.price | inr: true }}</span>
                          @if (pkg.reviews > 0) {
                            <span class="je-xs"><ion-icon name="star" color="warning" /> {{ pkg.rating }}</span>
                          } @else if (pkg.maxGuests) {
                            <span class="je-xs je-muted"><ion-icon name="people-outline" /> {{ pkg.maxGuests }}</span>
                          }
                        </span>
                      </div>
                    </button>
                  }
                </div>
              }

              @if (card.type === 'bookings' && card.bookings?.length) {
                <div class="stack">
                  @for (bk of card.bookings; track bk.id) {
                    <button class="bk je-card" (click)="go('booking:' + bk.id)">
                      <div class="bk__top">
                        <strong class="je-truncate">{{ bk.eventName }}</strong>
                        <app-status-pill [status]="$any(bk.status)" />
                      </div>
                      <span class="je-xs je-muted">{{ bk.eventDate | date: 'EEE, d MMM y' }}@if (bk.vendorName) { · {{ bk.vendorName }} }</span>
                      <span class="bk__money">
                        <span class="je-price">{{ bk.totalAmount | inr }}</span>
                        @if (bk.balanceDue > 0 && bk.amountPaid > 0) {
                          <span class="je-xs due">{{ bk.balanceDue | inr }} due</span>
                        }
                      </span>
                    </button>
                  }
                </div>
              }

              @if (card.type === 'rewards' && card.rewards; as r) {
                <button class="rewards" (click)="go('rewards')">
                  <span class="je-xs rewards__tier">{{ r.tier }} member</span>
                  <strong class="rewards__pts">{{ r.points | number }} <small>points</small></strong>
                  @if (r.nextTier && r.pointsToNextTier) {
                    <span class="je-xs">{{ r.pointsToNextTier | number }} more to {{ r.nextTier }}</span>
                  }
                </button>
              }
            }

            @if (msg.actions?.length) {
              <div class="actions">
                @for (action of msg.actions; track action.target) {
                  <button class="action" (click)="go(action.target)">{{ action.label }} <ion-icon name="arrow-forward" /></button>
                }
              </div>
            }
          }
        }

        @if (roshi.thinking()) {
          <div class="msg">
            <span class="avatar"><ion-icon name="sparkles" /></span>
            <div class="bubble bubble--roshi typing" aria-label="Roshi is typing"><i></i><i></i><i></i></div>
          </div>
        }
      </div>
    </ion-content>

    <ion-footer class="ion-no-border">
      @if (roshi.suggestions().length && !roshi.thinking()) {
        <div class="chips">
          @for (chip of roshi.suggestions(); track chip) {
            <button class="chip" (click)="send(chip)">{{ chip }}</button>
          }
        </div>
      }
      <ion-toolbar class="composer">
        <ion-textarea class="input" [rows]="1" [autoGrow]="true" [maxlength]="1000"
                      placeholder="Ask about packages, bookings, refunds…" [value]="draft()"
                      (ionInput)="draft.set($any($event.target).value ?? '')"
                      (keydown.enter)="onEnter($any($event))" />
        <ion-button slot="end" fill="clear" (click)="send(draft())" [disabled]="!draft().trim() || roshi.thinking()" aria-label="Send">
          <ion-icon slot="icon-only" name="send" color="primary" />
        </ion-button>
      </ion-toolbar>
      <p class="note">
        {{ roshi.poweredBy() === 'claude' ? 'Roshi uses AI and can make mistakes. Check details before you pay.' : 'Answers come from your JoinEvents account.' }}
      </p>
    </ion-footer>
  `,
  styles: [`
    .title { display: flex; align-items: center; gap: 10px; }
    .title__avatar, .avatar { display: grid; place-items: center; border-radius: 50%;
                              background: var(--je-gradient-primary); color: #fff; flex-shrink: 0; }
    .title__avatar { width: 34px; height: 34px; font-size: 17px; }
    .title__text { display: flex; flex-direction: column; line-height: 1.15; text-align: left; }
    .title__text strong { font-size: var(--je-fs-md); }
    .title__text small { font-size: var(--je-fs-xs); color: var(--je-text-muted); font-weight: 500; }

    .roshi { --background: var(--je-bg-app); }
    .thread { padding: 14px 14px 10px; display: flex; flex-direction: column; gap: 10px; }
    .msg { display: flex; align-items: flex-end; gap: 8px; }
    .msg--mine { justify-content: flex-end; }
    .avatar { width: 28px; height: 28px; font-size: 14px; }
    .bubble { max-width: 82%; padding: 10px 13px; border-radius: 16px 16px 16px 4px; font-size: var(--je-fs-sm);
              line-height: 1.5; background: var(--je-bg-card); border: 1px solid var(--je-border-color);
              color: var(--je-text-main); box-shadow: var(--je-shadow-sm); word-break: break-word; }
    .msg--mine .bubble { border-radius: 16px 16px 4px 16px; background: var(--je-gradient-primary); color: #fff; border-color: transparent; }
    .bubble p { margin: 0 0 6px; white-space: pre-wrap; }
    .bubble p:last-child { margin: 0; }
    .bubble ::ng-deep p { margin: 0 0 6px; }
    .bubble ::ng-deep p:last-child { margin-bottom: 0; }
    .bubble ::ng-deep ul { margin: 4px 0 6px; padding-left: 18px; }
    .bubble ::ng-deep li { margin: 2px 0; }
    .bubble--failed { border-style: dashed; border-color: var(--ion-color-danger); }

    .typing { display: flex; gap: 4px; padding: 14px; }
    .typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--je-text-soft); animation: blink 1.2s infinite ease-in-out; }
    .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes blink { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }

    button { font: inherit; color: inherit; background: none; border: 0; padding: 0; text-align: left; }
    .rail { display: flex; gap: 10px; overflow-x: auto; margin-left: 36px; padding: 2px 2px 6px; scroll-snap-type: x mandatory; }
    .pkg { flex: 0 0 200px; scroll-snap-align: start; border-radius: var(--je-radius-md); overflow: hidden;
           background: var(--je-bg-card); border: 1px solid var(--je-border-color); box-shadow: var(--je-shadow-sm); }
    .pkg__img { height: 104px; display: grid; place-items: center; background: var(--je-bg-light); color: var(--je-text-soft); font-size: 24px; }
    .pkg__img img { width: 100%; height: 100%; object-fit: cover; }
    .pkg__body { display: flex; flex-direction: column; gap: 3px; padding: 9px 11px 11px; min-width: 0; }
    .pkg__body strong { font-size: var(--je-fs-sm); color: var(--je-text-main); }
    .pkg__foot { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }

    .stack { display: flex; flex-direction: column; gap: 8px; margin-left: 36px; }
    .bk { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 12px 14px; width: 100%; }
    .bk__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .bk__top strong { font-size: var(--je-fs-sm); color: var(--je-text-main); }
    .bk__money { display: flex; align-items: baseline; justify-content: space-between; margin-top: 2px; }
    .due { color: var(--ion-color-warning-shade); font-weight: 600; }

    .rewards { margin-left: 36px; display: flex; flex-direction: column; gap: 3px; padding: 14px 16px; border-radius: var(--je-radius-md);
               background: linear-gradient(135deg, #F59E0B, #FF6B35); color: #fff; box-shadow: var(--je-shadow-sm); }
    .rewards__tier { text-transform: uppercase; letter-spacing: .06em; opacity: .9; font-weight: 700; }
    .rewards__pts { font-size: var(--je-fs-xl); font-family: var(--je-font-heading); }
    .rewards__pts small { font-size: var(--je-fs-sm); font-weight: 600; opacity: .9; }

    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: 36px; }
    .action { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--je-radius-full);
              background: var(--je-bg-card); border: 1px solid var(--ion-color-primary); color: var(--ion-color-primary);
              font-size: var(--je-fs-xs); font-weight: 700; }

    .chips { display: flex; gap: 8px; overflow-x: auto; padding: 8px 12px 4px; background: var(--je-bg-app); }
    .chip { flex-shrink: 0; padding: 7px 13px; border-radius: var(--je-radius-full); background: var(--je-bg-card);
            border: 1px solid var(--je-border-color); font-size: var(--je-fs-xs); font-weight: 600; color: var(--je-text-main); }
    .composer { --background: var(--je-bg-card); --padding-start: 12px; --padding-end: 6px; --min-height: 56px; }
    .input { --background: var(--je-bg-light); --padding-start: 14px; --padding-end: 14px; --padding-top: 10px; --padding-bottom: 10px;
             border-radius: var(--je-radius-lg); }
    .note { margin: 0; padding: 2px 16px calc(6px + var(--ion-safe-area-bottom, 0px)); text-align: center;
            font-size: 10px; color: var(--je-text-soft); background: var(--je-bg-card); }
  `]
})
export class RoshiPage implements ViewWillEnter {
  readonly roshi = inject(AssistantService);
  private router = inject(Router);
  private readonly scroller = viewChild<IonContent>('scroller');

  readonly draft = signal('');

  constructor() {
    // Follow the conversation as it grows.
    effect(() => {
      this.roshi.messages();
      this.roshi.thinking();
      setTimeout(() => void this.scroller()?.scrollToBottom(250), 40);
    });
  }

  ionViewWillEnter(): void {
    this.roshi.greet();
  }

  send(text: string): void {
    if (!text.trim() || this.roshi.thinking()) return;
    this.roshi.send(text);
    this.draft.set('');
  }

  /** Enter sends; Shift+Enter keeps a new line. */
  onEnter(event: KeyboardEvent): void {
    if (event.shiftKey) return;
    event.preventDefault();
    this.send(this.draft());
  }

  /** Cards and buttons name a screen; map it to this app's routes. */
  go(target: AssistantAction['target']): void {
    const at = target.indexOf(':');
    const kind = at < 0 ? target : target.slice(0, at);
    const id = at < 0 ? '' : target.slice(at + 1);
    const routes: Record<string, () => Promise<boolean>> = {
      booking: () => this.router.navigate(['/customer/booking', id]),
      package: () => this.router.navigate(['/customer/package', id]),
      category: () => this.router.navigate(['/customer/tabs/events'], { queryParams: { category: id } }),
      packages: () => this.router.navigate(['/customer/tabs/events']),
      bookings: () => this.router.navigate(['/customer/tabs/bookings']),
      rewards: () => this.router.navigate(['/customer/rewards']),
      quotes: () => this.router.navigate(['/customer/quotes']),
      messages: () => this.router.navigate(['/customer/tabs/messages']),
      support: () => this.router.navigate(['/customer/support'])
    };
    void (routes[kind] ?? routes['packages'])();
  }
}
