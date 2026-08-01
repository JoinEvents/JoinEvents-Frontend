import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Centralised API interceptor — auth headers & error handling in one file.
 *
 * • Reads the stored user from localStorage and attaches a Bearer token.
 * • Intercepts 401 → clears session, redirects to /login.
 * • Intercepts 403 → permission denied toast.
 * • Intercepts 500 → generic server error toast.
 * • Intercepts status 0 → network / CORS error toast.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast  = inject(ToastService);
  const auth   = inject(AuthService);

  // ── Attach auth header ──────────────────────────────────────
  let token: string | null = null;
  try {
    const stored = localStorage.getItem('joinevents_user');
    if (stored) {
      const user = JSON.parse(stored);
      // Security: Only use real tokens, never fallback to internal user IDs
      token = user.token || null;
    }
  } catch { /* corrupt storage — ignore */ }

  // Security/CORS: Do not attach local authorization Bearer tokens to external API calls (e.g. OpenStreetMap, Nominatim, CDNs)
  const isExternal = req.url.startsWith('http') && !req.url.startsWith(environment.apiUrl);

  const authReq = (token && !isExternal)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // ── Global error handling ───────────────────────────────────
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const suppressErrors = req.headers.has('X-Suppress-Errors');

      if (!suppressErrors) {
        switch (error.status) {
          case 401:
            // Don't show "Session expired" for the login request itself
            if (!req.url.includes('/auth/login')) {
              toast.warning('Session expired. Please log in again.');
              auth.logout();
            }
            break;
          case 403:
            toast.error('You do not have permission to perform this action.');
            break;
          case 500:
          case 502:
          case 503:
            toast.error('Something went wrong on our end. Please try again later.');
            break;
          case 0:
            toast.error('Network error. Please check your connection.');
            break;
        }
      }
      return throwError(() => error);
    })
  );
};
