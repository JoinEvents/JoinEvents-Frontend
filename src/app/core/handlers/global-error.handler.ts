import { ErrorHandler, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Global error boundary for the entire application.
 *
 * Angular doesn't have React-style <ErrorBoundary> wrappers, so we use
 * a custom ErrorHandler + a signal that the root App component watches.
 * When a fatal (unhandled) error is caught the UI can swap to a
 * full-screen fallback.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  /** True when an unrecoverable error has been caught. */
  readonly hasFatalError = signal(false);

  /** The last error object for logging / display. */
  readonly lastError = signal<any>(null);

  handleError(error: any): void {
    // Log to console for dev visibility (suppressed in production)
    if (!environment.production) { console.error('[GlobalErrorHandler]', error); }

    // Chunk-loading failures (lazy routes) are common after deploys —
    // a full page reload usually fixes them.
    const msg = error?.message ?? '';
    if (msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) {
      window.location.reload();
      return;
    }

    // For other unhandled errors, set the fatal flag so the App component
    // can render the fallback error screen.
    this.lastError.set(error);
    this.hasFatalError.set(true);
  }

  /** Called from the error-screen "Try Again" button. */
  clearError(): void {
    this.lastError.set(null);
    this.hasFatalError.set(false);
  }
}
