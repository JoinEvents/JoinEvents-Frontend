import { inject, Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { CustomerProfile } from '../models/user.model';
import { AuthService } from './auth.service';
import { resolveMediaUrl } from '../utils/media-url.util';

@Injectable({ providedIn: 'root' })
export class ProfileService extends BaseApiService {
  private auth = inject(AuthService);

  /**
   * Fetches the profile and syncs the stored session with it. The session is
   * only written at login, so without this a photo or name changed on the
   * website would never reach the app until the user signed out and back in.
   */
  getProfile(): Observable<CustomerProfile | null> {
    return this.get<unknown>(API_ROUTES.PROFILE.BASE).pipe(
      map(res => this.single<CustomerProfile>(res)),
      map(profile => {
        if (profile) {
          // The avatar is always taken from the server, so a removed photo clears too.
          this.auth.updateUserProfile({
            ...(profile.name ? { name: profile.name } : {}),
            ...(profile.phone ? { phone: profile.phone } : {}),
            avatar: resolveMediaUrl(profile.avatar)
          });
        }
        return profile;
      }),
      catchError(() => of(null))
    );
  }

  /** Fire-and-forget session refresh for app start, resume and page entry. */
  refreshCurrentUser(): void {
    if (!this.auth.isAuthenticated()) return;
    this.getProfile().subscribe();
  }

  updateProfile(data: Record<string, unknown>): Observable<boolean> {
    return this.patch<unknown>(API_ROUTES.PROFILE.BASE, data, false).pipe(
      map(() => {
        this.auth.updateUserProfile({
          name: data['name'] as string | undefined,
          phone: data['phone'] as string | undefined
        });
        return true;
      }),
      catchError(() => of(false))
    );
  }

  updatePassword(currentPassword: string, newPassword: string): Observable<boolean> {
    return this.put<unknown>(API_ROUTES.PROFILE.PASSWORD, { currentPassword, newPassword }, false).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  deleteAccount(): Observable<boolean> {
    return this.delete<unknown>(API_ROUTES.PROFILE.BASE, false).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Captures or picks an avatar and uploads it.
   *
   * The photo comes back as base64 rather than a file URI so the same code path
   * works on both platforms — iOS hands back a `file://` URI the WebView cannot
   * read without a permission dance, while Android's content URI needs resolving.
   */
  changeAvatar(source: CameraSource): Observable<string | null> {
    return from(
      Camera.getPhoto({
        quality: 75,
        width: 720,
        height: 720,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source,
        promptLabelHeader: 'Profile photo',
        promptLabelPhoto: 'Choose from gallery',
        promptLabelPicture: 'Take a photo'
      })
    ).pipe(
      switchMap((photo: Photo) => {
        if (!photo.base64String) return of(null);
        const blob = this.base64ToBlob(photo.base64String, `image/${photo.format || 'jpeg'}`);
        const form = new FormData();
        form.append('file', blob, `avatar.${photo.format || 'jpg'}`);
        return this.post<{ url?: string; avatarUrl?: string }>(API_ROUTES.PROFILE.AVATAR, form, false).pipe(
          map(res => {
            const url = resolveMediaUrl(res?.url ?? res?.avatarUrl) ?? null;
            if (url) this.auth.updateUserProfile({ avatar: url });
            return url;
          })
        );
      }),
      catchError(() => of(null))
    );
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
    return new Blob([buffer], { type: mimeType });
  }

  private single<T>(res: unknown): T | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as T) ?? null;
  }
}
