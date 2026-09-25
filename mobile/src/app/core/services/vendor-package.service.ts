import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { resolveMediaUrl } from '../utils/media-url.util';
import { serverMessage } from '../utils/server-message.util';

export interface VendorPackage {
  id: string;
  name: string;
  category: string;
  tier: string;
  price: number;
  isActive: boolean;
  status: string;
  images: string[];
  maxGuests?: number;
  totalBookings?: number;
  rating?: number;
}

/** The package id on success, or a message fit to show the vendor. */
export interface SaveResult {
  id?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class VendorPackageService extends BaseApiService {
  getMyPackages(category?: string, status?: string, page = 1, pageSize = 20): Observable<VendorPackage[]> {
    return this.get<unknown>(API_ROUTES.VENDOR_PACKAGES.BASE, { category, status, page, pageSize }, false).pipe(
      map(res => this.unwrap(res).map(p => this.toPackage(p))),
      catchError(() => of([] as VendorPackage[]))
    );
  }

  getById(id: string): Observable<Record<string, unknown> | null> {
    return this.get<unknown>(API_ROUTES.VENDOR_PACKAGES.BY_ID(id), undefined, false).pipe(
      map(res => this.single(res)),
      catchError(() => of(null))
    );
  }

  /**
   * Creates a package. The server's reason is passed back on failure — it is
   * usually actionable (KYC still pending, business profile incomplete), and a
   * generic "could not create" left vendors with no way forward.
   */
  create(payload: Record<string, unknown>): Observable<SaveResult> {
    return this.post<unknown>(API_ROUTES.VENDOR_PACKAGES.BASE, payload).pipe(
      map(res => {
        const id = this.single(res)?.['id'] as string | undefined;
        return id ? { id } : { error: 'Could not create the package. Please try again.' };
      }),
      catchError(err => of({ error: serverMessage(err, 'Could not create the package. Please try again.') }))
    );
  }

  update(id: string, payload: Record<string, unknown>): Observable<SaveResult> {
    return this.put<unknown>(API_ROUTES.VENDOR_PACKAGES.BY_ID(id), payload).pipe(
      map(() => ({ id })),
      catchError(err => of({ error: serverMessage(err, 'Could not save the changes. Please try again.') }))
    );
  }

  remove(id: string): Observable<boolean> {
    return this.ok(this.delete<unknown>(API_ROUTES.VENDOR_PACKAGES.BY_ID(id), false));
  }

  toggleStatus(id: string, isActive: boolean): Observable<boolean> {
    return this.ok(this.patch<unknown>(API_ROUTES.VENDOR_PACKAGES.STATUS(id), { isActive }, false));
  }

  /** Uploads gallery images captured with the device camera or picked from the roll. */
  uploadImages(id: string, files: { blob: Blob; name: string }[]): Observable<SaveResult> {
    const form = new FormData();
    files.forEach(f => form.append('files', f.blob, f.name));
    return this.post<unknown>(API_ROUTES.VENDOR_PACKAGES.IMAGES(id), form).pipe(
      map(() => ({ id })),
      catchError(err => of({ error: serverMessage(err, 'The photos could not be uploaded.') }))
    );
  }

  private toPackage(p: Record<string, unknown>): VendorPackage {
    return {
      id: String(p['id'] ?? ''),
      name: String(p['name'] ?? ''),
      category: String(p['category'] ?? p['categoryKey'] ?? ''),
      tier: String(p['tier'] ?? ''),
      price: Number((p['pricing'] as Record<string, unknown> | undefined)?.['basePrice'] ?? p['price'] ?? p['basePrice'] ?? 0),
      isActive: Boolean(p['isActive'] ?? true),
      status: String(p['status'] ?? 'draft'),
      images: Array.isArray(p['images'])
        ? (p['images'] as unknown[])
            .map(item => resolveMediaUrl(typeof item === 'string' ? item : (item as { url?: string } | null)?.url))
            .filter((url): url is string => !!url)
        : [],
      maxGuests: ((p['capacity'] as Record<string, unknown> | undefined)?.['maxGuests'] ?? p['maxGuests']) as number | undefined,
      totalBookings: p['totalBookings'] as number | undefined,
      rating: p['rating'] as number | undefined
    };
  }

  private ok(source: Observable<unknown>): Observable<boolean> {
    return source.pipe(map(() => true), catchError(() => of(false)));
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[]; items?: unknown[]; packages?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    // Package lists come back as { packages: [...], totalCount, ... }.
    return ((payload?.data ?? payload?.items ?? payload?.packages ?? []) as Record<string, unknown>[]);
  }

  private single(res: unknown): Record<string, unknown> | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as Record<string, unknown>) ?? null;
  }
}
