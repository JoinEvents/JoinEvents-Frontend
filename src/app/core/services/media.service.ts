import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { validateFileUpload } from '../utils/input-sanitizer.util';

/**
 * Uploads images that are stored on a record and displayed later — portfolio shots,
 * inclusion photos.
 *
 * Separate from SupportService.uploadAttachment, which these used to go through: support
 * attachments land in a private container behind an expiring link, so a URL saved from that
 * endpoint stops working. This endpoint returns a permanent one.
 */
@Injectable({ providedIn: 'root' })
export class MediaService extends BaseApiService {
  private static readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private static readonly MAX_BYTES = 5 * 1024 * 1024;

  uploadImage(file: File): Observable<{ url: string; path: string }> {
    const validation = validateFileUpload(file, MediaService.ALLOWED_TYPES, MediaService.MAX_BYTES);
    if (!validation.valid) {
      return throwError(() => new Error(validation.error));
    }

    const formData = new FormData();
    formData.append('file', file);
    return this.post<{ url: string; path: string }>('/files/images', formData, false);
  }
}
