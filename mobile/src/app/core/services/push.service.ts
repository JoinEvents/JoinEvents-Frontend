import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';

/**
 * Native push notifications (FCM on Android, APNs on iOS).
 *
 * The device token is registered against the signed-in account so the backend
 * can target booking, message, payment and verification events at the right
 * device. Taps are routed to the same deep links the in-app notification list
 * uses, so both entry points land on the same screen.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private auth = inject(AuthService);
  private router = inject(Router);
  private logger = inject(LoggerService);
  private notifications = inject(NotificationService);

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      this.logger.warn('Push permission not granted');
      return;
    }

    await PushNotifications.register();

    await PushNotifications.addListener('registration', (token: Token) => {
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      this.auth.registerDeviceToken(token.value, platform).subscribe();
    });

    await PushNotifications.addListener('registrationError', error => {
      this.logger.error('Push registration failed', error);
    });

    // Delivered while the app is open: refresh the badge instead of interrupting.
    await PushNotifications.addListener('pushNotificationReceived', (_n: PushNotificationSchema) => {
      this.notifications.refresh();
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      const link = action.notification.data?.['link'] as string | undefined;
      if (link) void this.router.navigateByUrl(link);
      this.notifications.refresh();
    });
  }

  /** Clears the OS badge and delivered tray items, e.g. after opening the inbox. */
  async clearDelivered(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await PushNotifications.removeAllDeliveredNotifications().catch(() => void 0);
  }
}
