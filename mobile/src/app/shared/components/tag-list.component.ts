import { Component, input, model, signal } from '@angular/core';
import { IonItem, IonInput, IonButton, IonIcon, IonChip, IonLabel } from '@ionic/angular/standalone';

/** Editable list of short strings (e.g. a category's popular services). */
@Component({
  selector: 'app-tag-list',
  standalone: true,
  imports: [IonItem, IonInput, IonButton, IonIcon, IonChip, IonLabel],
  template: `
    <ion-item class="je-field" lines="none">
      <ion-input [value]="draft()" [placeholder]="placeholder()"
                 (ionInput)="draft.set($any($event.target).value ?? '')"
                 (keyup.enter)="add()" />
      <ion-button slot="end" fill="clear" (click)="add()" aria-label="Add">
        <ion-icon slot="icon-only" name="add" />
      </ion-button>
    </ion-item>
    @if (value().length) {
      <div class="chips">
        @for (tag of value(); track tag) {
          <ion-chip (click)="remove(tag)">
            <ion-label>{{ tag }}</ion-label>
            <ion-icon name="close-circle" />
          </ion-chip>
        }
      </div>
    }
  `,
  styles: [`
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    ion-chip { margin: 0; --background: var(--je-bg-light); --color: var(--je-text-main);
               font-size: var(--je-fs-xs); font-weight: 600; }
  `]
})
export class TagListComponent {
  readonly value = model<string[]>([]);
  readonly placeholder = input('Add and press enter');
  readonly draft = signal('');

  /** Commas split into several entries, as the web form's comma-separated input does. */
  add(): void {
    const incoming = this.draft().split(',').map(s => s.trim()).filter(Boolean);
    if (!incoming.length) return;
    const existing = new Set(this.value().map(v => v.toLowerCase()));
    const fresh = incoming.filter(v => !existing.has(v.toLowerCase()) && existing.add(v.toLowerCase()));
    this.value.set([...this.value(), ...fresh]);
    this.draft.set('');
  }

  remove(tag: string): void {
    this.value.set(this.value().filter(t => t !== tag));
  }
}
