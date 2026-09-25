import { Component, input, model } from '@angular/core';
import { IonItem, IonInput, IonNote } from '@ionic/angular/standalone';

/**
 * Bootstrap Icons class input (the format the API stores and the web renders),
 * with a live preview and the icons already used in the catalogue as one-tap
 * suggestions.
 */
@Component({
  selector: 'app-icon-field',
  standalone: true,
  imports: [IonItem, IonInput, IonNote],
  template: `
    <ion-item class="je-field" lines="none">
      <span slot="start" class="preview" [style.background]="gradient() || 'var(--je-gradient-primary)'">
        <i class="bi {{ value() }}"></i>
      </span>
      <ion-input [value]="value()" (ionInput)="value.set(clean($any($event.target).value))"
                 placeholder="Icon class, e.g. bi-hearts" autocapitalize="none" autocorrect="off" />
    </ion-item>
    <ion-note class="je-xs hint">
      Any Bootstrap icon — browse names at icons.getbootstrap.com
    </ion-note>
    @if (suggestions().length) {
      <div class="icons">
        @for (icon of suggestions(); track icon) {
          <button type="button" class="icon" [class.icon--on]="icon === value()"
                  (click)="value.set(icon)" [attr.aria-label]="icon">
            <i class="bi {{ icon }}"></i>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .preview { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
               color: #fff; font-size: 17px; margin-inline-end: 10px; }
    .hint { display: block; margin: -4px 4px 8px; }
    .icons { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    .icon { width: 38px; height: 38px; border-radius: 10px; font-size: 18px;
            border: 1px solid var(--je-border-color); background: var(--je-bg-light); color: var(--je-text-main); }
    .icon--on { background: var(--je-primary); color: #fff; border-color: var(--je-primary); }
  `]
})
export class IconFieldComponent {
  readonly value = model('');
  readonly suggestions = input<string[]>([]);
  readonly gradient = input<string>('');

  /** Accepts "bi bi-gem" or "gem" as well as "bi-gem". */
  clean(raw: string | null | undefined): string {
    const token = (raw ?? '').trim().split(/\s+/).filter(t => t !== 'bi').pop() ?? '';
    if (!token) return '';
    return token.startsWith('bi-') ? token : `bi-${token}`;
  }
}
