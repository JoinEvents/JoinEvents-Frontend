import { Camera, ImageOptions, Photo } from '@capacitor/camera';

/**
 * Wraps Camera.getPhoto so a dismissed picker is not mistaken for a failure.
 *
 * Returns null when the user backs out; throws with a readable message for
 * real errors (permission denied, no camera app), which callers should show —
 * swallowing those is what made photo uploads look like they "did nothing".
 */
export async function pickPhoto(options: ImageOptions): Promise<Photo | null> {
  try {
    return await Camera.getPhoto(options);
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    if (/cancel|no image picked|no photo/i.test(message)) return null;
    if (/permission|denied/i.test(message)) {
      throw new Error('Allow camera and photo access for JoinEvents in your phone settings, then try again.');
    }
    throw new Error(message || 'Could not open the camera or gallery.');
  }
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mimeType });
}

/**
 * Capacitor reports the format as e.g. "jpeg" or "png"; the API accepts
 * .jpg/.jpeg/.png/.webp/.gif and checks the MIME type, so normalize both.
 */
export function photoFileInfo(format: string | undefined): { mime: string; ext: string } {
  const f = (format || 'jpeg').toLowerCase();
  if (f === 'png') return { mime: 'image/png', ext: 'png' };
  if (f === 'webp') return { mime: 'image/webp', ext: 'webp' };
  if (f === 'gif') return { mime: 'image/gif', ext: 'gif' };
  return { mime: 'image/jpeg', ext: 'jpg' };
}
