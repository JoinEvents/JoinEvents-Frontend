import { environment } from '../../../environments/environment';

/**
 * The API host, without the versioned path segment. Uploaded files are served from the
 * storage account rather than from here, but rows written before that move still hold
 * server-relative paths such as "/files/verification/....pdf".
 */
const API_ORIGIN = environment.apiUrl.replace(/\/api\/v\d+\/?$/, '');

/**
 * Turns whatever the API returned for a file into something an <img> or <a> can use.
 *
 * The API now returns absolute URLs for anything in object storage, and those must be passed
 * through untouched — a SAS link carries a query string, and prefixing it with the API host
 * (which is what every call site used to do) produces a 404. Only genuinely relative values
 * get the host prepended.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Same rule, but returns null for an absent value so callers can fall back to initials. */
export function resolveMediaUrlOrNull(url: string | null | undefined): string | null {
  return url ? resolveMediaUrl(url) : null;
}

/**
 * Appends a cache-busting parameter with the correct separator.
 *
 * A plain `url + '?t='` corrupts any URL that already carries a query string — which a signed
 * storage link always does.
 */
export function withCacheBuster(url: string): string {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}
