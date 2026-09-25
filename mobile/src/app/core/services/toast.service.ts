import { inject, Injectable } from '@angular/core';
import { ToastController, LoadingController, AlertController } from '@ionic/angular/standalone';
import { Haptics, NotificationType } from '@capacitor/haptics';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

const ICONS: Record<ToastKind, string> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning'
};

const COLORS: Record<ToastKind, string> = {
  success: 'success',
  error: 'danger',
  info: 'primary',
  warning: 'warning'
};

/**
 * Native feedback surface. Replaces the web app's inline toast component with
 * platform toasts, alerts and loading indicators, plus haptics so success and
 * failure are felt as well as seen.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private loading: HTMLIonLoadingElement | null = null;

  async show(message: string, kind: ToastKind = 'success', duration = 3000): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      position: 'top',
      color: COLORS[kind],
      icon: ICONS[kind],
      cssClass: 'je-toast',
      buttons: [{ role: 'cancel', icon: 'close' }]
    });
    await toast.present();
    await this.vibrate(kind);
  }

  success(message: string): Promise<void> { return this.show(message, 'success'); }
  error(message: string): Promise<void> { return this.show(message, 'error', 4000); }
  info(message: string): Promise<void> { return this.show(message, 'info'); }
  warning(message: string): Promise<void> { return this.show(message, 'warning'); }

  async showLoading(message = 'Please wait…'): Promise<void> {
    await this.hideLoading();
    this.loading = await this.loadingCtrl.create({ message, spinner: 'crescent' });
    await this.loading.present();
  }

  async hideLoading(): Promise<void> {
    if (!this.loading) return;
    await this.loading.dismiss().catch(() => void 0);
    this.loading = null;
  }

  /** Resolves true only when the user picks the confirming button. */
  async confirm(header: string, message: string, confirmText = 'Confirm', destructive = false): Promise<boolean> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [
          { text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
          {
            text: confirmText,
            role: destructive ? 'destructive' : 'confirm',
            cssClass: destructive ? 'je-alert-destructive' : undefined,
            handler: () => resolve(true)
          }
        ]
      });
      // Not awaited: onDidDismiss only settles after the alert is shown and
      // closed, so awaiting it before present() left every confirm invisible.
      void alert.onDidDismiss().then(detail => {
        if (detail.role === 'backdrop') resolve(false);
      });
      await alert.present();
    });
  }

  /** Resolves the typed text, or null when dismissed. */
  async prompt(header: string, placeholder: string, confirmText = 'Submit'): Promise<string | null> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header,
        inputs: [{ name: 'value', type: 'textarea', placeholder }],
        buttons: [
          { text: 'Cancel', role: 'cancel', handler: () => resolve(null) },
          { text: confirmText, handler: data => resolve((data?.value ?? '').trim() || null) }
        ]
      });
      await alert.present();
    });
  }

  private async vibrate(kind: ToastKind): Promise<void> {
    const type = kind === 'error' ? NotificationType.Error
      : kind === 'warning' ? NotificationType.Warning
      : NotificationType.Success;
    await Haptics.notification({ type }).catch(() => void 0);
  }
}
