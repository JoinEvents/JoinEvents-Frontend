import { Injectable, signal } from '@angular/core';
import { Network } from '@capacitor/network';

/**
 * Connectivity state. A phone loses signal constantly, so pages subscribe to
 * this rather than assuming every request will reach the API.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly online = signal(true);
  readonly connectionType = signal<string>('unknown');

  async init(): Promise<void> {
    const status = await Network.getStatus();
    this.online.set(status.connected);
    this.connectionType.set(status.connectionType);

    await Network.addListener('networkStatusChange', status => {
      this.online.set(status.connected);
      this.connectionType.set(status.connectionType);
    });
  }
}
