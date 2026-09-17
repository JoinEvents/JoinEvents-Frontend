import { Pipe, PipeTransform } from '@angular/core';

/**
 * Indian-format rupees. `Intl` groups by lakh/crore under en-IN, which is what
 * the web app renders and what the audience reads — 12,50,000 rather than
 * 1,250,000.
 */
@Pipe({ name: 'inr', standalone: true })
export class CurrencyInrPipe implements PipeTransform {
  transform(value: number | null | undefined, compact = false): string {
    const amount = Number(value ?? 0);
    if (compact) {
      if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(amount % 10_000_000 === 0 ? 0 : 1)}Cr`;
      if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(amount % 100_000 === 0 ? 0 : 1)}L`;
      if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`;
    }
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
}
