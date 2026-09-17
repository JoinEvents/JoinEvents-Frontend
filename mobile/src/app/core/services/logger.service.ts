import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Console logging that goes quiet in production builds, so a shipped binary
 * does not leak request payloads into the device log. `error` always fires —
 * it is the hook a crash reporter would be attached to.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private enabled = !environment.production;

  log(message: string, ...data: unknown[]): void {
    if (this.enabled) console.log(`[JoinEvents] ${message}`, ...data);
  }

  warn(message: string, ...data: unknown[]): void {
    if (this.enabled) console.warn(`[JoinEvents] ${message}`, ...data);
  }

  debug(message: string, ...data: unknown[]): void {
    if (this.enabled) console.debug(`[JoinEvents] ${message}`, ...data);
  }

  error(message: string, ...data: unknown[]): void {
    console.error(`[JoinEvents] ${message}`, ...data);
  }
}
