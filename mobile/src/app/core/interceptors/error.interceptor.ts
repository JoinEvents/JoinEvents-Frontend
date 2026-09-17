import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { LoggerService } from '../services/logger.service';

/**
 * Central failure handling.
 *
 * - 401 ends the session and sends the user back to login.
 * - 0 is reported as an offline/unreachable error rather than a server error,
 *   which on a phone is by far the most common cause.
 * - Callers that pass `X-Suppress-Errors` render the failure inline instead,
 *   so no toast is raised for them.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const logger = inject(LoggerService);

  const suppress = req.headers.has('X-Suppress-Errors');
  const cleaned = suppress ? req.clone({ headers: req.headers.delete('X-Suppress-Errors') }) : req;

  return next(cleaned).pipe(
    catchError((error: HttpErrorResponse) => {
      logger.error(`HTTP ${error.status} ${req.method} ${req.url}`, error.error);

      if (error.status === 401 && auth.isAuthenticated()) {
        auth.logout();
        void router.navigateByUrl('/auth/login', { replaceUrl: true });
        if (!suppress) void toast.error('Your session expired. Please sign in again.');
        return throwError(() => error);
      }

      if (!suppress) void toast.error(describe(error));
      return throwError(() => error);
    })
  );
};

function describe(error: HttpErrorResponse): string {
  if (error.status === 0) return 'No connection. Check your network and try again.';
  const body = error.error as { error?: string; message?: string } | undefined;
  if (body?.error) return body.error;
  if (body?.message) return body.message;
  if (error.status === 403) return 'You do not have access to this.';
  if (error.status === 404) return 'We could not find what you were looking for.';
  if (error.status >= 500) return 'The server had a problem. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}
