import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { API_ROUTES } from '../constants/api.constants';
import { validateFileUpload } from '../utils/input-sanitizer.util';

@Injectable({ providedIn: 'root' })
export class ProfileService extends BaseApiService {
  getProfile(): Observable<any> {
    return this.get<any>(API_ROUTES.CUSTOMER.PROFILE).pipe(
      map(res => res.data || res.profile || res),
      catchError(() => of(null))
    );
  }

  updateProfile(data: any): Observable<any> {
    return this.patch<any>(API_ROUTES.CUSTOMER.PROFILE, data).pipe(
      map(res => res),
      catchError(err => {
        console.error('Update profile error', err);
        return of(null);
      })
    );
  }

  updatePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.put<any>('/profile/password', { currentPassword, newPassword }).pipe(
      map(res => res),
      catchError(err => {
        console.error('Update password error', err);
        return of({ success: false, error: err.error?.error || 'Failed to update password' });
      })
    );
  }

  deleteAccount(): Observable<any> {
    return this.delete<any>('/profile').pipe(
      map(res => res),
      catchError(err => {
        console.error('Delete account error', err);
        return of({ success: false, error: err.error?.error || 'Failed to delete account' });
      })
    );
  }

  uploadAvatar(file: File): Observable<any> {
    const validation = validateFileUpload(file, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], 5 * 1024 * 1024);
    if (!validation.valid) {
      return throwError(() => new Error(validation.error));
    }

    const formData = new FormData();
    formData.append('file', file);
    return this.post<any>('/profile/avatar', formData).pipe(
      map(res => res),
      catchError(err => {
        console.error('Upload avatar error', err);
        return of({ success: false, error: err.error?.error || 'Failed to upload avatar' });
      })
    );
  }
}
