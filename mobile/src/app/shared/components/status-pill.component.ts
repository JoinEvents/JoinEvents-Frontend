import { Component, computed, input } from '@angular/core';

/** Booking/ticket status chip using the shared `.je-pill--*` palette. */
@Component({
  selector: 'app-status-pill',
  standalone: true,
  template: `<span class="je-pill" [class]="'je-pill--' + status()">{{ label() }}</span>`
})
export class StatusPillComponent {
  readonly status = input.required<string>();
  readonly label = computed(() =>
    this.status()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}
