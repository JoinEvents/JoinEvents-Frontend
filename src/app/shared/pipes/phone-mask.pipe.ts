import { Pipe, PipeTransform } from '@angular/core';

/**
 * PhoneMaskPipe — Anti-Disintermediation Defense
 *
 * Masks customer phone numbers for vendor-facing views to prevent
 * vendors from taking customers off-platform for future bookings.
 *
 * Usage:
 *   {{ phoneNumber | phoneMask }}            → +91 98XXX XX210
 *   {{ phoneNumber | phoneMask:'full' }}     → +91 98765 43210 (admin/support only)
 *   {{ phoneNumber | phoneMask:'hidden' }}   → Contact via JoinEvents
 */
@Pipe({
  name: 'phoneMask',
  standalone: true,
})
export class PhoneMaskPipe implements PipeTransform {
  transform(value: string | undefined | null, mode: 'masked' | 'full' | 'hidden' = 'masked'): string {
    if (!value) return 'N/A';

    if (mode === 'full') {
      return value;
    }

    if (mode === 'hidden') {
      return 'Contact via JoinEvents';
    }

    // Masked mode: show first 4 and last 3 digits
    const digits = value.replace(/\D/g, '');

    if (digits.length < 7) {
      return 'XXXXX XXXXX';
    }

    // For Indian numbers: +91 98XXX XX210
    if (digits.length >= 10) {
      const last3 = digits.slice(-3);
      const first = digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
      const firstTwo = digits.slice(-10, -8);
      const prefix = first ? `+${first} ` : '';
      return `${prefix}${firstTwo}XXX XX${last3}`;
    }

    // Fallback for shorter numbers
    const first2 = digits.slice(0, 2);
    const last3 = digits.slice(-3);
    return `${first2}XXX XX${last3}`;
  }
}
