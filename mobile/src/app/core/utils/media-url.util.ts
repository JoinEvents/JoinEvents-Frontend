import { environment } from '../../../environments/environment';

/** The API host, without the versioned path segment. */
const API_ORIGIN = environment.apiUrl.replace(/\/api\/v\d+\/?$/, '');

/**
 * Turns whatever the API returned for a file into something an <img> can load.
 *
 * Absolute URLs (object storage, including signed links with a query string) pass
 * through untouched; older rows still hold server-relative paths such as
 * "/files/...", which need the API host in front. Mirrors the web app's helper.
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
