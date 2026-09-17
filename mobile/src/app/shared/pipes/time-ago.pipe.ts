import { Pipe, PipeTransform } from '@angular/core';

/** Relative timestamps for chat, notifications and activity feeds. */
@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return '';

    const seconds = Math.floor((Date.now() - then) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}
