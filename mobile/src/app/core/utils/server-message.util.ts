import { HttpErrorResponse } from '@angular/common/http';

/**
 * The human-readable reason from a failed API call, or `fallback`.
 *
 * The API reports failures as `{ error: "..." }` (sometimes `{ message }`), and
 * those messages are written for the end user — e.g. "KYC Verification pending"
 * — so surfacing them beats a generic "something went wrong".
 */
export function serverMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Could not reach the server. Check your connection and try again.';
    const body = error.error as { error?: unknown; message?: unknown } | string | null;
    if (typeof body === 'string' && body.trim() && body.length < 300) return body;
    if (body && typeof body === 'object') {
      const text = body.error ?? body.message;
      if (typeof text === 'string' && text.trim()) return text;
    }
  }
  return fallback;
}
