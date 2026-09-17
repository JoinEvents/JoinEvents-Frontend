import { Pipe, PipeTransform } from '@angular/core';

/**
 * Masks all but the last four digits. Support and admin screens list customer
 * and vendor numbers; agents rarely need the full number to do their job, and
 * an unmasked one on screen is a number that can be shoulder-surfed.
 */
@Pipe({ name: 'phoneMask', standalone: true })
export class PhoneMaskPipe implements PipeTransform {
  transform(value: string | null | undefined, reveal = false): string {
    if (!value) return '—';
    const digits = value.replace(/\D/g, '');
    if (reveal) return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : value;
    if (digits.length < 4) return '••••';
    return `••••• ${digits.slice(-4)}`;
  }
}
