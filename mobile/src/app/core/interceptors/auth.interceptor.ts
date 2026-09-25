import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Attaches the bearer token to every JoinEvents API call.
 *
 * FormData bodies are left untouched — the browser sets the multipart
 * boundary itself, and overriding Content-Type would corrupt uploads.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Third-party calls (e.g. the address lookup) must never carry the user's token.
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const auth = inject(AuthService);
  const token = auth.getToken();

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(req.body instanceof FormData) && !req.headers.has('Content-Type')) {
    headers['Content-Type'] = 'application/json';
  }

  return Object.keys(headers).length ? next(req.clone({ setHeaders: headers })) : next(req);
};
