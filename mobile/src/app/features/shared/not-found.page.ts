import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon],
  template: `
    <ion-content class="ion-padding">
      <div class="je-empty wrap">
        <ion-icon name="compass-outline" />
        <h3>This page has moved on</h3>
        <p>We couldn't find what you were looking for.</p>
        <ion-button class="je-btn-gradient" (click)="goHome()">Take me home</ion-button>
      </div>
    </ion-content>
  `,
  styles: [`.wrap { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }`]
})
export class NotFoundPage {
  private router = inject(Router);
  private auth = inject(AuthService);

  goHome(): void {
    void this.router.navigateByUrl(this.auth.homeRoute(), { replaceUrl: true });
  }
}
