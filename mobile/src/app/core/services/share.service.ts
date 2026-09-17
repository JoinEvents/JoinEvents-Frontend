import { Injectable } from '@angular/core';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Native share sheet. Used to send a package, a booking confirmation or a
 * referral code out to WhatsApp, Messages and the rest — the single biggest
 * acquisition channel this category has, and something the web app cannot do.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  async sharePackage(name: string, id: string, price?: number): Promise<void> {
    const priceLine = price ? ` from ₹${price.toLocaleString('en-IN')}` : '';
    await this.share({
      title: name,
      text: `Look at "${name}"${priceLine} on JoinEvents.`,
      url: `https://joinevents.in/events/package/${id}`,
      dialogTitle: 'Share this package'
    });
  }

  async shareReferral(code: string): Promise<void> {
    await this.share({
      title: 'Join me on JoinEvents',
      text: `Plan your next event on JoinEvents. Use my code ${code} and we both earn reward points.`,
      url: `https://joinevents.in/register?ref=${encodeURIComponent(code)}`,
      dialogTitle: 'Invite a friend'
    });
  }

  async shareBooking(bookingNumber: string, eventName: string, date: string): Promise<void> {
    await this.share({
      title: eventName,
      text: `${eventName} is confirmed for ${date}. Booking ${bookingNumber} — booked on JoinEvents.`,
      dialogTitle: 'Share booking'
    });
  }

  private async share(options: { title: string; text: string; url?: string; dialogTitle: string }): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // Browser preview: fall back to the Web Share API, then to the clipboard.
      if (navigator.share) {
        await navigator.share({ title: options.title, text: options.text, url: options.url }).catch(() => void 0);
        return;
      }
      await navigator.clipboard?.writeText(`${options.text} ${options.url ?? ''}`.trim()).catch(() => void 0);
      return;
    }
    await Share.share(options).catch(() => void 0);
  }
}
