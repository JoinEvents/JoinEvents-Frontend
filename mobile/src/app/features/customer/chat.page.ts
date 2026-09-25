import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
  IonTextarea, IonFooter, IonSpinner
} from '@ionic/angular/standalone';
import { ViewWillEnter, ViewWillLeave } from '@ionic/angular';

import { MessengerService, ChatMessage } from '../../core/services/messenger.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Chat thread. New messages arrive over the live connection; the page polls only while
 * that connection is down, and stops on leave — a background poll on a phone is a battery
 * cost with no benefit.
 */
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    DatePipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon,
    IonTextarea, IonFooter, IonSpinner
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/customer/tabs/messages" text="" />
        </ion-buttons>
        <ion-title>{{ title() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content #scroller class="chat">
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent" /></div>
      } @else {
        <div class="thread">
          @for (message of messages(); track message.id; let i = $index) {
            @if (showDateSeparator(i)) {
              <div class="daysep"><span>{{ message.sentAt | date: 'd MMM y' }}</span></div>
            }
            <div class="msg" [class.msg--mine]="isMine(message)">
              <div class="bubble">
                <p>{{ message.body }}</p>
                <span class="stamp">{{ message.sentAt | date: 'shortTime' }}</span>
              </div>
            </div>
          } @empty {
            <div class="je-empty">
              <ion-icon name="chatbubble-ellipses-outline" />
              <h3>Say hello</h3>
              <p>Ask about availability, pricing or anything else.</p>
            </div>
          }
        </div>
      }
    </ion-content>

    <ion-footer class="ion-no-border">
      <ion-toolbar class="composer">
        @if (threadClosed()) {
          <p class="closed je-sm je-muted">
            <ion-icon name="lock-closed-outline" /> This conversation is closed.
          </p>
        } @else {
          <ion-textarea class="input" [rows]="1" [autoGrow]="true" [maxlength]="1000"
                        placeholder="Write a message" [value]="draft()"
                        (ionInput)="draft.set($any($event.target).value)" />
          <ion-button slot="end" fill="clear" (click)="send()" [disabled]="!draft().trim() || sending()">
            @if (sending()) { <ion-spinner name="dots" /> }
            @else { <ion-icon slot="icon-only" name="send" color="primary" /> }
          </ion-button>
        }
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .center { display: grid; place-items: center; height: 60vh; }
    .chat { --background: var(--je-bg-app); }
    .thread { padding: 16px 14px 8px; display: flex; flex-direction: column; gap: 8px; }

    .daysep { display: flex; justify-content: center; margin: 12px 0 6px; }
    .daysep span { padding: 4px 12px; border-radius: var(--je-radius-full);
                   background: var(--je-bg-light); color: var(--je-text-muted);
                   font-size: var(--je-fs-xs); font-weight: 600; }

    .msg { display: flex; }
    .msg--mine { justify-content: flex-end; }
    .bubble { max-width: 78%; padding: 10px 13px 6px; border-radius: 16px 16px 16px 4px;
              background: var(--je-bg-card); border: 1px solid var(--je-border-color);
              box-shadow: var(--je-shadow-sm); }
    .msg--mine .bubble { border-radius: 16px 16px 4px 16px; background: var(--je-gradient-primary);
                         border-color: transparent; }
    .bubble p { margin: 0; font-size: var(--je-fs-sm); line-height: 1.5; color: var(--je-text-main);
                white-space: pre-wrap; word-break: break-word; }
    .msg--mine .bubble p { color: #fff; }
    .stamp { display: block; text-align: right; margin-top: 3px;
             font-size: 10px; color: var(--je-text-soft); }
    .msg--mine .stamp { color: rgba(255,255,255,0.8); }

    .composer { --background: var(--je-bg-card); --padding-start: 12px; --padding-end: 6px;
                --min-height: 56px; padding-bottom: var(--ion-safe-area-bottom, 0px); }
    .input { --background: var(--je-bg-light); --padding-start: 14px; --padding-end: 14px;
             --padding-top: 10px; --padding-bottom: 10px; border-radius: var(--je-radius-lg); }
    .closed { display: flex; align-items: center; justify-content: center; gap: 6px;
              margin: 0; padding: 14px; }
  `]
})
export class ChatPage implements ViewWillEnter, ViewWillLeave {
  private route = inject(ActivatedRoute);
  private messenger = inject(MessengerService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  private readonly scroller = viewChild<IonContent>('scroller');

  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly draft = signal('');
  readonly threadClosed = signal(false);
  readonly title = signal('Chat');

  private poll?: Subscription;
  private live?: Subscription;
  private threadId = '';

  ionViewWillEnter(): void {
    this.threadId = this.route.snapshot.paramMap.get('threadId') ?? '';
    if (!this.threadId) {
      this.loading.set(false);
      return;
    }

    this.messenger.activeThreadId.set(this.threadId);
    const thread = this.messenger.threads().find(t => t.id === this.threadId);
    if (thread) {
      this.title.set(thread.participantName);
    } else {
      // Opened from a notification or a booking: the list has not been loaded yet.
      this.messenger.getThreads().subscribe(threads => {
        const found = threads.find(t => t.id === this.threadId);
        if (found) this.title.set(found.participantName);
      });
    }

    this.messenger.isAlive(this.threadId).subscribe(alive => this.threadClosed.set(!alive));
    this.messenger.markAsRead(this.threadId).subscribe();

    this.poll = this.messenger.pollMessages(this.threadId).subscribe(messages => {
      const isFirstLoad = this.loading();
      const hasNew = messages.length !== this.messages().length;
      this.messages.set(messages);
      this.loading.set(false);
      if (isFirstLoad || hasNew) this.scrollToBottom(isFirstLoad);
    });

    // Messages from the other side appear as they are sent.
    this.live = this.messenger.liveMessages$.subscribe(message => {
      if (message.threadId !== this.threadId) return;
      if (this.messages().some(m => m.id === message.id)) return;
      this.messages.update(list => [...list, message]);
      this.scrollToBottom();
      if (!this.isMine(message)) this.messenger.markAsRead(this.threadId).subscribe();
    });
  }

  ionViewWillLeave(): void {
    this.poll?.unsubscribe();
    this.poll = undefined;
    this.live?.unsubscribe();
    this.live = undefined;
    this.messenger.activeThreadId.set(null);
  }

  isMine(message: ChatMessage): boolean {
    return message.senderId === this.auth.currentUser()?.id;
  }

  /** Only show a date divider when the day changes between messages. */
  showDateSeparator(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(this.messages()[index].sentAt).toDateString();
    const previous = new Date(this.messages()[index - 1].sentAt).toDateString();
    return current !== previous;
  }

  send(): void {
    const body = this.draft().trim();
    if (!body || this.sending()) return;

    this.sending.set(true);
    this.draft.set('');

    this.messenger.send(this.threadId, body).subscribe(message => {
      this.sending.set(false);
      if (!message) {
        void this.toast.error('Message not sent. Check your connection.');
        this.draft.set(body); // Give the text back so it is not lost.
        return;
      }
      // The hub may have delivered our own message already.
      if (!this.messages().some(m => m.id === message.id)) this.messages.update(list => [...list, message]);
      this.scrollToBottom();
    });
  }

  private scrollToBottom(instant = false): void {
    setTimeout(() => void this.scroller()?.scrollToBottom(instant ? 0 : 250), 60);
  }
}
