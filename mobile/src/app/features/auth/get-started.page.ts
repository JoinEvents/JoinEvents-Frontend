import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { StorageService } from '../../core/services/storage.service';

interface Slide {
  icon: string;
  title: string;
  body: string;
}

/**
 * First-run carousel. Mirrors the web landing page's value propositions, cut
 * down to what fits a phone screen without scrolling.
 */
@Component({
  selector: 'app-get-started',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon],
  template: `
    <ion-content [fullscreen]="true" class="hero">
      <div class="wrap">
        <header class="brand">
          <div class="mark">JE</div>
          <h1>JoinEvents</h1>
          <p>Everything your event needs, in one place.</p>
        </header>

        <section class="slide">
          <div class="slide__icon">
            <ion-icon [name]="current().icon" />
          </div>
          <h2>{{ current().title }}</h2>
          <p>{{ current().body }}</p>

          <div class="dots">
            @for (slide of slides; track slide.title; let i = $index) {
              <button class="dot" [class.dot--on]="i === index()" (click)="index.set(i)"
                      [attr.aria-label]="'Go to slide ' + (i + 1)"></button>
            }
          </div>
        </section>

        <footer class="actions je-safe-bottom">
          @if (index() < slides.length - 1) {
            <ion-button expand="block" class="je-btn-gradient" (click)="next()">Next</ion-button>
            <ion-button expand="block" fill="clear" color="medium" (click)="finish('/auth/login')">Skip</ion-button>
          } @else {
            <ion-button expand="block" class="je-btn-gradient" (click)="finish('/auth/register')">
              Create an account
            </ion-button>
            <ion-button expand="block" fill="outline" (click)="finish('/auth/login')">I already have one</ion-button>
            <button class="partner" (click)="finish('/auth/partner-login')">
              Are you a vendor or partner? Sign in here
            </button>
          }
        </footer>
      </div>
    </ion-content>
  `,
  styles: [`
    .hero { --background: var(--je-gradient-hero); }
    .wrap {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      padding: calc(32px + var(--ion-safe-area-top, 0px)) 24px 24px;
    }
    .brand { text-align: center; }
    .mark {
      width: 58px; height: 58px; margin: 0 auto 14px;
      display: grid; place-items: center;
      border-radius: var(--je-radius-md);
      background: var(--je-gradient-primary);
      color: #fff; font-family: var(--je-font-heading);
      font-weight: 700; font-size: 22px;
      box-shadow: 0 10px 26px rgba(255, 107, 53, 0.35);
    }
    .brand h1 { font-size: var(--je-fs-2xl); margin: 0; }
    .brand p { color: var(--je-text-muted); font-size: var(--je-fs-sm); margin: 6px 0 0; }

    .slide { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .slide__icon {
      width: 108px; height: 108px; margin-bottom: 24px;
      display: grid; place-items: center;
      border-radius: var(--je-radius-xl);
      background: var(--je-bg-card);
      box-shadow: var(--je-shadow-md);
    }
    .slide__icon ion-icon { font-size: 50px; color: var(--je-primary); }
    .slide h2 { font-size: var(--je-fs-xl); margin: 0 0 10px; }
    .slide p { color: var(--je-text-muted); font-size: var(--je-fs-base); max-width: 300px; margin: 0; line-height: 1.55; }

    .dots { display: flex; gap: 8px; margin-top: 28px; }
    .dot { width: 8px; height: 8px; padding: 0; border: none; border-radius: 50%; background: var(--je-text-soft); opacity: 0.4; }
    .dot--on { width: 22px; border-radius: 4px; opacity: 1; background: var(--je-primary); }

    .actions { display: flex; flex-direction: column; gap: 4px; }
    .partner {
      margin-top: 10px; background: none; border: none;
      color: var(--je-text-muted); font-size: var(--je-fs-sm); font-weight: 600;
      text-decoration: underline;
    }
  `]
})
export class GetStartedPage {
  private router = inject(Router);
  private storage = inject(StorageService);

  readonly slides: Slide[] = [
    {
      icon: 'sparkles',
      title: 'Plan any event',
      body: 'Weddings, birthdays, corporate days and more — browse curated packages from verified vendors near you.'
    },
    {
      icon: 'chatbubbles',
      title: 'Get quotes, fast',
      body: 'Post what you need once and let vendors bid for it. Compare offers side by side and pick your favourite.'
    },
    {
      icon: 'shield-checkmark',
      title: 'Book with confidence',
      body: 'Payments are held in escrow until your event is done, and every vendor is verified before they can list.'
    }
  ];

  readonly index = signal(0);
  current(): Slide { return this.slides[this.index()]; }

  next(): void {
    this.index.update(i => Math.min(i + 1, this.slides.length - 1));
  }

  /** Marks onboarding seen so relaunches go straight to sign-in. */
  finish(route: string): void {
    this.storage.set('joinevents_onboarded', 'true');
    void this.router.navigateByUrl(route);
  }
}
