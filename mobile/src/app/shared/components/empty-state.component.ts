import { Component, input, output } from '@angular/core';
import { IonIcon, IonButton } from '@ionic/angular/standalone';

/** Shared "nothing here yet" panel, so every list fails the same way. */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IonIcon, IonButton],
  template: `
    <div class="je-empty">
      <ion-icon [name]="icon()" />
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      @if (actionLabel()) {
        <ion-button size="small" class="je-btn-gradient" (click)="action.emit()">
          {{ actionLabel() }}
        </ion-button>
      }
    </div>
  `
})
export class EmptyStateComponent {
  readonly icon = input('file-tray-outline');
  readonly title = input('Nothing here yet');
  readonly message = input('');
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();
}
