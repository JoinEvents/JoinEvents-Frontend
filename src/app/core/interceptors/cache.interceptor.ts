import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

const cache = new Map<string, { response: HttpResponse<any>; expiry: number }>();
const TTL_MS = 60000; // 1 minute TTL

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  // Only cache GET requests, and bypass cache for messenger/chat endpoints
  if (req.method !== 'GET' || req.url.includes('/messenger/')) {
    return next(req);
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
