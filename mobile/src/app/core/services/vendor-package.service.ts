import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { resolveMediaUrl } from '../utils/media-url.util';

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

  create(payload: Record<string, unknown>): Observable<Record<string, unknown> | null> {
    return this.post<unknown>(API_ROUTES.VENDOR_PACKAGES.BASE, payload, false).pipe(
      map(res => this.single(res)),
      catchError(() => of(null))
    );
  }

  update(id: string, payload: Record<string, unknown>): Observable<boolean> {
    return this.ok(this.put<unknown>(API_ROUTES.VENDOR_PACKAGES.BY_ID(id), payload, false));
  }

  remove(id: string): Observable<boolean> {
    return this.ok(this.delete<unknown>(API_ROUTES.VENDOR_PACKAGES.BY_ID(id), false));
  }

  toggleStatus(id: string, isActive: boolean): Observable<boolean> {
    return this.ok(this.patch<unknown>(API_ROUTES.VENDOR_PACKAGES.STATUS(id), { isActive }, false));
  }

  /** Uploads gallery images captured with the device camera or picked from the roll. */
  uploadImages(id: string, files: { blob: Blob; name: string }[]): Observable<boolean> {
    const form = new FormData();
    files.forEach(f => form.append('files', f.blob, f.name));
    return this.ok(this.post<unknown>(API_ROUTES.VENDOR_PACKAGES.IMAGES(id), form, false));
  }

  private toPackage(p: Record<string, unknown>): VendorPackage {
    return {
      id: String(p['id'] ?? ''),
      name: String(p['name'] ?? ''),
      category: String(p['category'] ?? p['categoryKey'] ?? ''),
      tier: String(p['tier'] ?? ''),
      price: Number(p['price'] ?? p['basePrice'] ?? 0),
      isActive: Boolean(p['isActive'] ?? true),
      status: String(p['status'] ?? 'draft'),
      images: Array.isArray(p['images'])
        ? (p['images'] as unknown[])
            .map(item => resolveMediaUrl(typeof item === 'string' ? item : (item as { url?: string } | null)?.url))
            .filter((url): url is string => !!url)
        : [],
      maxGuests: p['maxGuests'] as number | undefined,
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
