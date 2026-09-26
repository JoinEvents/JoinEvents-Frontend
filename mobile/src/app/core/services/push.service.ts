import { effect, inject, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';

/** The Android channel the API sends on; high importance so notifications pop up with sound. */
export const PUSH_CHANNEL = 'joinevents';

/**
 * Native push notifications (FCM on Android, APNs on iOS), for every role.
 *
 * The phone's token is registered against whoever is signed in, whenever that changes (sign-in,
 * switching accounts), and removed on sign-out (AuthService.logout), so a shared phone never
 * shows the previous user's notifications. A tap opens the link the API sent: that role's
 * booking, chat, ticket or verification screen.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private auth = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private logger = inject(LoggerService);
  private notifications = inject(NotificationService);

  private deviceToken: string | null = null;
  private registeredFor: string | null = null;
  private started = false;

  constructor() {
    // Register with the account as soon as there is both a signed-in user and a device token.
    effect(() => {
      const user = this.auth.currentUser();
      if (!user?.token) {
        this.registeredFor = null;
        return;
      }
      this.registerWithAccount(user.id);
    });
  }

  async init(): Promise<void> {
    if (this.started || !Capacitor.isNativePlatform() || !environment.pushEnabled) return;
    this.started = true;
    try {
      await this.setUp();
    } catch (error) {
      // Push is best-effort: a failure here must never take the app down with it.
      this.logger.error('Push setup failed', error);
    }
  }

  private async setUp(): Promise<void> {
    // Listeners first, so a tap that launched the app is not missed.
    await PushNotifications.addListener('registration', (token: Token) => {
      this.zone.run(() => {
        this.deviceToken = token.value;
        const user = this.auth.currentUser();
        if (user?.token) this.registerWithAccount(user.id, true);
      });
    });

    await PushNotifications.addListener('registrationError', error => {
      this.logger.error('Push registration failed', error);
    });

    // Delivered while the app is open: the live connection already shows it; refresh the list.
    await PushNotifications.addListener('pushNotificationReceived', () => {
      this.zone.run(() => this.notifications.refresh());
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      this.zone.run(() => {
        const link = action.notification.data?.['link'] as string | undefined;
        if (link && link.startsWith('/') && this.auth.currentUser()) void this.router.navigateByUrl(link);
        this.notifications.refresh();
      });
    });

    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: PUSH_CHANNEL,
        name: 'Bookings and messages',
        description: 'Bookings, payments, messages and support updates',
        importance: 5,
        visibility: 1,
        vibration: true
      }).catch(error => this.logger.warn('Push channel not created', error));
    }

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      this.logger.warn('Push permission not granted');
      return;
    }
    await PushNotifications.register();
  }

  private registerWithAccount(userId: string, force = false): void {
    if (!this.deviceToken || (!force && this.registeredFor === userId)) return;
    this.registeredFor = userId;
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    this.auth.registerDeviceToken(this.deviceToken, platform).subscribe();
  }

  /** Clears the OS badge and delivered tray items, e.g. after opening the inbox. */
  async clearDelivered(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await PushNotifications.removeAllDeliveredNotifications().catch(() => void 0);
  }
}
