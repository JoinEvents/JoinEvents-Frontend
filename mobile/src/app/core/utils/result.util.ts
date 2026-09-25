import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { serverMessage } from './server-message.util';

/** An API outcome that carries the server's own reason when it fails. */
export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Wraps a request so a failure arrives as the server's message instead of an exception. */
export function toResult<T>(source: Observable<T>, fallback: string): Observable<ApiResult<T>> {
  return source.pipe(
    map(value => ({ ok: true, value }) as ApiResult<T>),
    catchError(error => of({ ok: false, error: serverMessage(error, fallback) } as ApiResult<T>))
  );
}
