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

/**
 * Centre-crops a picked photo to 4:3 and re-encodes it as JPEG — the frame the
 * web console's cropper produces for package photos, so cards look the same on
 * both. Returns null if the image cannot be decoded.
 */
export function cropToLandscape(base64: string, mime: string, width = 1200): Promise<Blob | null> {
  const height = Math.round(width * 3 / 4);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      // Cover: scale so the frame is filled, then centre.
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
    };
    img.onerror = () => resolve(null);
    img.src = `data:${mime};base64,${base64}`;
  });
}
