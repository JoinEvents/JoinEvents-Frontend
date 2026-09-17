import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { NetworkService } from '../../core/services/network.service';

/** Persistent strip shown whenever the device drops connectivity. */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [IonIcon],
  template: `
    @if (!network.online()) {
      <div class="offline">
        <ion-icon name="cloud-offline" />
        <span>You're offline — showing the last loaded data.</span>
      </div>
    }
  `,
  styles: [`
    .offline {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: calc(6px + var(--ion-safe-area-top, 0px)) 12px 6px;
      background: var(--je-text-main);
      color: #fff;
      font-size: var(--je-fs-xs);
      font-weight: 600;
    }
    ion-icon { font-size: 15px; }
  `]
})
export class OfflineBannerComponent {
  network = inject(NetworkService);
}
