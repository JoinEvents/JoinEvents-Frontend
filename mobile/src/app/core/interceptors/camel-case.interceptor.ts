import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * The backend serializes with `PropertyNamingPolicy = null`, so any response
 * built from a C# class arrives in PascalCase (`Images`, `Id`, `Packages`),
 * while anonymous objects arrive camelCase. The app's mappers read camelCase,
 * so PascalCase fields — package images among them — silently came back empty.
 * Normalizing once here keeps every service on a single key convention.
 */
export const camelCaseInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  return next(req).pipe(
    map(event =>
      event instanceof HttpResponse && event.body && typeof event.body === 'object'
        ? event.clone({ body: toCamelCaseKeys(event.body) })
        : event
    )
  );
};

export function toCamelCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamelCaseKeys);
  if (!isPlainObject(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const camel = key.charAt(0).toLowerCase() + key.slice(1);
    // An explicit camelCase key wins over its PascalCase twin, should both exist.
    if (camel in result && camel !== key) continue;
    result[camel] = toCamelCaseKeys(child);
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
