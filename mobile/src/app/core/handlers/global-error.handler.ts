import { ErrorHandler, inject, Injectable, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../services/toast.service';

/**
 * Last line of defence for uncaught errors. HTTP failures are already handled
 * by the error interceptor, so they are logged and dropped here rather than
 * shown twice.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);
  private toast = inject(ToastService);
  private zone = inject(NgZone);

  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      this.logger.error('Unhandled HTTP error', error);
      return;
    }
    this.logger.error('Unhandled error', error);
    this.zone.run(() => void this.toast.error('Something went wrong. Please try again.'));
  }
}
