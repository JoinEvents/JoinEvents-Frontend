import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Centralized logging service.
 * Suppresses all console output in production to prevent information leakage.
 * In development, logs are passed through to the browser console.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {

  log(message: string, ...data: any[]): void {
    if (!environment.production) {
      console.log(`[JoinEvents] ${message}`, ...data);
    }
  }

  warn(message: string, ...data: any[]): void {
    if (!environment.production) {
      console.warn(`[JoinEvents] ${message}`, ...data);
    }
  }

  error(message: string, ...data: any[]): void {
    if (!environment.production) {
      console.error(`[JoinEvents] ${message}`, ...data);
    }
    // In production, errors could be sent to an external monitoring service
    // e.g., Sentry, LogRocket, Google Cloud Error Reporting
  }

  debug(message: string, ...data: any[]): void {
    if (!environment.production) {
      console.debug(`[JoinEvents] ${message}`, ...data);
    }
  }
}
