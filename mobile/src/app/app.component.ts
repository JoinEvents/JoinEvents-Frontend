import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';

import { StorageService } from './core/services/storage.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { NetworkService } from './core/services/network.service';
import { PushService } from './core/services/push.service';
import { FavoritesService } from './core/services/favorites.service';
import { LocationService } from './core/services/location.service';
import { ProfileService } from './core/services/profile.service';
import { OfflineBannerComponent } from './shared/components/offline-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, OfflineBannerComponent],
  template: `
    <ion-app>
      <app-offline-banner />
      <ion-router-outlet />
    </ion-app>
  `
})
export class AppComponent implements OnInit {
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private theme = inject(ThemeService);
  private network = inject(NetworkService);
  private push = inject(PushService);
  private favorites = inject(FavoritesService);
  private location = inject(LocationService);
  private profile = inject(ProfileService);
  private router = inject(Router);

  constructor() {
    addIcons(icons as unknown as Record<string, string>);
  }

  async ngOnInit(): Promise<void> {
    // Storage must hydrate first — the session, theme and saved city all
    // come out of it, and the router's guards read the session synchronously.
    await this.storage.hydrate();
    this.auth.restoreSession();
    // Pick up profile changes made elsewhere (e.g. a new photo on the website).
    this.profile.refreshCurrentUser();
    this.theme.init();
    this.favorites.init();
    this.location.init();
    await this.network.init();

    await this.router.navigateByUrl(this.landingRoute(), { replaceUrl: true });

    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide();
      await this.push.init();
      this.wireHardwareBackButton();
      void CapacitorApp.addListener('resume', () => this.profile.refreshCurrentUser());
    }
  }

  private landingRoute(): string {
    if (this.auth.isAuthenticated()) return this.auth.homeRoute();
    return this.storage.get('joinevents_onboarded') ? '/auth/login' : '/auth/get-started';
  }

  /**
   * Android's hardware back button has no browser equivalent. Without this the
   * button does nothing on a root tab; here it exits the app instead, which is
   * the behaviour Android users expect.
   */
  private wireHardwareBackButton(): void {
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void CapacitorApp.exitApp();
      }
    });
  }
}
