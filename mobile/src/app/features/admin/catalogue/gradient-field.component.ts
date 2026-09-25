import { Component, computed, input, model } from '@angular/core';
import { IonItem, IonInput } from '@ionic/angular/standalone';

import { buildGradient, parseGradient } from '../../../core/utils/catalogue.util';

/**
 * Card gradient editor, matching the web console: a live preview, the
 * gradients already used in the catalogue as one-tap swatches, a two-colour
 * builder with direction, and the raw CSS for anything more elaborate.
 */
@Component({
  selector: 'app-gradient-field',
  standalone: true,
  imports: [IonItem, IonInput],
  template: `
    <div class="preview" [style.background]="value() || 'var(--je-gradient-primary)'">
      @if (icon()) { <i class="bi {{ icon() }}"></i> }
    </div>

    @if (suggestions().length) {
      <p class="je-xs je-soft label">Used in your catalogue</p>
      <div class="swatches">
        @for (g of suggestions(); track g) {
          <button type="button" class="swatch" [class.swatch--on]="g === value()"
                  [style.background]="g" (click)="value.set(g)" [attr.aria-label]="g"></button>
        }
      </div>
    }

    <p class="je-xs je-soft label">Custom colours</p>
    <div class="builder">
      <label class="color">
        <input type="color" [value]="parts().color1" (input)="setColor('color1', $any($event.target).value)" />
        <span class="je-xs">{{ parts().color1 }}</span>
      </label>
      <label class="color">
        <input type="color" [value]="parts().color2" (input)="setColor('color2', $any($event.target).value)" />
        <span class="je-xs">{{ parts().color2 }}</span>
      </label>
      <div class="dirs">
        @for (d of directions; track d.value) {
          <button type="button" class="dir" [class.dir--on]="parts().direction === d.value"
                  (click)="setDirection(d.value)" [attr.aria-label]="d.value">{{ d.label }}</button>
        }
      </div>
    </div>

    <ion-item class="je-field" lines="none">
      <ion-input [value]="value()" (ionInput)="value.set($any($event.target).value ?? '')"
                 placeholder="CSS gradient, e.g. linear-gradient(135deg,#E91E8C,#FF6B6B)" />
    </ion-item>
  `,
  styles: [`
    .preview { height: 64px; border-radius: var(--je-radius-md); display: grid; place-items: center;
               color: #fff; font-size: 26px; margin-bottom: 10px; }
    .label { margin: 8px 0 6px; }
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
    .swatch { width: 34px; height: 34px; border-radius: 10px; border: 2px solid transparent; }
    .swatch--on { border-color: var(--je-text-main); }
    .builder { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
    .color { display: flex; align-items: center; gap: 6px; font-family: monospace; }
    .color input { width: 36px; height: 36px; padding: 0; border: none; border-radius: 8px; background: none; }
    .dirs { display: flex; gap: 4px; }
    .dir { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--je-border-color);
           background: var(--je-bg-light); color: var(--je-text-main); }
    .dir--on { background: var(--je-primary); color: #fff; border-color: var(--je-primary); }
  `]
})
export class GradientFieldComponent {
  readonly value = model('');
  readonly suggestions = input<string[]>([]);
  readonly icon = input<string>('');

  /** CSS angles for the direction buttons; the arrow is only the label. */
  readonly directions = [
    { label: '→', value: '90deg' },
    { label: '↘', value: '135deg' },
    { label: '↓', value: '180deg' },
    { label: '↙', value: '225deg' },
    { label: '↗', value: '45deg' }
  ];

  /**
   * The builder works on the current gradient's own stops. When the value is
   * not a simple two-stop gradient, it starts from the theme's primary colour
   * read from CSS rather than from a colour written into the component.
   */
  readonly parts = computed(() => parseGradient(this.value()) ?? {
    direction: '135deg',
    color1: this.themeColor('--je-primary'),
    color2: this.themeColor('--je-secondary')
  });

  setColor(which: 'color1' | 'color2', color: string): void {
    this.value.set(buildGradient({ ...this.parts(), [which]: color }));
  }

  setDirection(direction: string): void {
    this.value.set(buildGradient({ ...this.parts(), direction }));
  }

  private themeColor(variable: string): string {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    // <input type="color"> only accepts #rrggbb.
    return /^#[\da-fA-F]{6}$/.test(raw) ? raw : /^#[\da-fA-F]{3}$/.test(raw)
      ? '#' + raw.slice(1).split('').map(c => c + c).join('')
      : '#000000';
  }
}
