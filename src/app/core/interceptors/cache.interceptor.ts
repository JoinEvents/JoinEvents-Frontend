import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

const cache = new Map<string, { response: HttpResponse<any>; expiry: number }>();
const TTL_MS = 60000; // 1 minute TTL

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  // Only cache GET requests, and bypass cache for messenger/chat, verification, support, and dashboard endpoints
  if (req.method !== 'GET' || 
      req.url.includes('/messenger') || 
      req.url.includes('/verification') || 
      req.url.includes('/support') || 
      req.url.includes('/dashboard') || 
      req.url.includes('/vendor/dashboard') ||
      req.headers.has('X-Bypass-Cache')) {
    
    // Set headers to force the browser native network stack to bypass cache
    const bypassHeaders = req.headers
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .delete('X-Bypass-Cache');

    const cleanReq = req.clone({ headers: bypassHeaders });
    return next(cleanReq);
  }

  const cached = cache.get(req.urlWithParams);
  const now = Date.now();

  if (cached && cached.expiry > now) {
    return of(cached.response.clone());
  }

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        cache.set(req.urlWithParams, {
          response: event,
          expiry: Date.now() + TTL_MS
        });
      }
    })
  );
};
