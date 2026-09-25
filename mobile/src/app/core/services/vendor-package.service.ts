import { Injectable, signal } from '@angular/core';
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
  /** API status: Active (verified, live), PendingReview or Rejected. */
  status: string;
  /** The reviewer's note when a package is sent back. */
  verificationComment?: string;
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
  /**
   * Bumped after a package is saved in the editor. The list lives in a tab
   * outlet that gets no ionViewWillEnter when a page above the tabs is popped,
   * so it reloads on this instead.
   */
  readonly version = signal(0);

  markChanged(): void {
    this.version.update(v => v + 1);
  }

  getMyPackages(category?: string, status?: string, page = 1, pageSize = 100): Observable<VendorPackage[]> {
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

  /** Resolves null on success, or the server's reason. */
  remove(id: string): Observable<string | null> {
    return this.delete<unknown>(API_ROUTES.VENDOR_PACKAGES.BY_ID(id)).pipe(
      map(() => null),
      catchError(err => of(serverMessage(err, 'Could not delete the package.')))
    );
  }

  /** Resolves null on success, or the server's reason. */
  toggleStatus(id: string, isActive: boolean): Observable<string | null> {
    return this.patch<unknown>(API_ROUTES.VENDOR_PACKAGES.STATUS(id), { isActive }).pipe(
      map(() => null),
      catchError(err => of(serverMessage(err, 'Could not change the package status.')))
    );
  }

  private toPackage(p: Record<string, unknown>): VendorPackage {
    return {
      id: String(p['id'] ?? ''),
      name: String(p['name'] ?? ''),
      category: String(p['category'] ?? p['categoryKey'] ?? ''),
      // The API stores the tier name as the package's theme.
      tier: String(p['theme'] ?? p['tier'] ?? ''),
      price: Number((p['pricing'] as Record<string, unknown> | undefined)?.['basePrice'] ?? p['price'] ?? p['basePrice'] ?? 0),
      isActive: Boolean(p['isActive'] ?? true),
      status: String(p['status'] ?? ''),
      verificationComment: (p['verificationComment'] as string | null) ?? undefined,
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
