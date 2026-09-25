import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { resolveMediaUrl } from '../utils/media-url.util';
import { serverMessage } from '../utils/server-message.util';

/**
 * Uploads an image that is saved on a record and shown later (package and
 * service photos) — the web's MediaService. /files/images returns a permanent
 * URL, unlike the support-attachment endpoint whose links expire.
 */
@Injectable({ providedIn: 'root' })
export class MediaService extends BaseApiService {
  uploadImage(blob: Blob, fileName: string): Observable<{ url?: string; error?: string }> {
    const form = new FormData();
    form.append('file', blob, fileName);
    return this.post<{ url?: string }>(API_ROUTES.IMAGE_UPLOAD, form).pipe(
      map(res => {
        const url = resolveMediaUrl(res?.url);
        return url ? { url } : { error: 'The photo could not be saved.' };
      }),
      catchError(err => of({ error: serverMessage(err, 'The photo could not be uploaded.') }))
    );
  }
}
