import { Component, input } from '@angular/core';

/**
 * Loading placeholder shaped like the content it replaces, so the layout does
 * not jump when data arrives.
 */
@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  template: `
    @for (row of rows(); track $index) {
      <div class="je-card sk-row">
        <div class="je-skeleton sk-thumb"></div>
        <div class="sk-lines">
          <div class="je-skeleton sk-line sk-line--lg"></div>
          <div class="je-skeleton sk-line sk-line--md"></div>
          <div class="je-skeleton sk-line sk-line--sm"></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .sk-row { display: flex; gap: 14px; align-items: center; }
    .sk-thumb { width: 64px; height: 64px; border-radius: var(--je-radius-sm); flex-shrink: 0; }
    .sk-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .sk-line { height: 11px; border-radius: 6px; }
    .sk-line--lg { width: 72%; }
    .sk-line--md { width: 52%; }
    .sk-line--sm { width: 34%; }
  `]
})
export class ListSkeletonComponent {
  readonly count = input(4);
  rows(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
