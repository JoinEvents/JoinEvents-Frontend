import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { resolveMediaUrl } from '../utils/media-url.util';
import { EventPackage, EventType } from '../models/event.model';
import { Tier } from '../models/catalogue.model';

export interface PackageSearchParams {
  category?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  guests?: number;
  tier?: string;
  date?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class PackageService extends BaseApiService {
  /** Event categories shown on the browse screen. */
  getEventTypes(): Observable<EventType[]> {
    return this.get<unknown>(API_ROUTES.EVENT_CATEGORIES).pipe(
      map(res => this.unwrap(res).map(c => this.toEventType(c))),
      catchError(() => of([] as EventType[]))
    );
  }

  /** Paged package search — the mobile browse and infinite-scroll feed. */
  search(params: PackageSearchParams = {}): Observable<EventPackage[]> {
    // Named as the API's SearchPackages reads them; minPrice/maxPrice/guests were silently ignored.
    const query = {
      category: params.category,
      city: params.city,
      priceMin: params.minPrice,
      priceMax: params.maxPrice,
      maxGuests: params.guests,
      tier: params.tier,
      eventDate: params.date,
      sortBy: params.sort,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20
    };
    return this.get<unknown>(API_ROUTES.PACKAGES.SEARCH, query, false).pipe(
      map(res => this.unwrap(res).map(p => this.toPackage(p))),
      catchError(() => of([] as EventPackage[]))
    );
  }

  /**
   * Falls back to the vendor endpoint when the public one 404s, so a vendor
   * previewing their own unpublished package still sees it.
   */
  getById(id: string): Observable<EventPackage | null> {
    return this.get<unknown>(`/packages/${id}`, undefined, false).pipe(
      map(res => this.toPackage(this.single(res))),
      catchError(() =>
        this.get<unknown>(API_ROUTES.VENDOR_PACKAGES.BY_ID(id), undefined, false).pipe(
          map(res => this.toPackage(this.single(res))),
          catchError(() => of(null))
        )
      )
    );
  }

  /** Active pricing tiers as the admin configured them (all categories). */
  getTiers(): Observable<Tier[]> {
    return this.get<unknown>(API_ROUTES.TIERS).pipe(
      map(res => this.unwrap(res) as unknown as Tier[]),
      catchError(() => of([] as Tier[]))
    );
  }

  getServiceCategories(): Observable<{ id: string; name: string }[]> {
    return this.get<unknown>(API_ROUTES.SERVICE_CATEGORIES).pipe(
      map(res =>
        this.unwrap(res).map(c => ({
          id: String(c['id'] ?? c['categoryKey'] ?? ''),
          name: String(c['name'] ?? '')
        }))
      ),
      catchError(() => of([]))
    );
  }

  // ---- normalisation ---------------------------------------------------

  /** Image lists arrive as plain URLs or as { url } objects; both become loadable URLs. */
  private toImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map(item => resolveMediaUrl(typeof item === 'string' ? item : (item as { url?: string } | null)?.url))
      .filter((url): url is string => !!url);
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[]; items?: unknown[]; packages?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    // Package lists come back as { packages: [...], totalCount, ... }.
    return ((payload?.data ?? payload?.items ?? payload?.packages ?? []) as Record<string, unknown>[]);
  }

  private single(res: unknown): Record<string, unknown> {
    const payload = res as { data?: unknown } | null;
    return ((payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) ?? {}) as Record<string, unknown>;
  }

  private toEventType(c: Record<string, unknown>): EventType {
    return {
      id: String(c['categoryKey'] ?? c['id'] ?? ''),
      uuid: c['id'] !== undefined ? String(c['id']) : undefined,
      name: String(c['name'] ?? ''),
      nameHindi: c['nameHindi'] as string | undefined,
      description: String(c['description'] ?? ''),
      // Only what the catalogue says; screens fall back to the theme when a value is unset.
      icon: String(c['icon'] ?? ''),
      category: String(c['categoryKey'] ?? c['category'] ?? ''),
      colorClass: (c['colorClass'] as string | null) ?? undefined,
      gradient: (c['gradient'] as string | null) || undefined,
      startingPrice: Number(c['startingPrice'] ?? 0),
      popularServices: (c['popularServices'] as string[]) ?? []
    };
  }

  private toPackage(p: Record<string, unknown>): EventPackage {
    const images = this.toImageUrls(p['images']);
    return {
      id: String(p['id'] ?? p['packageId'] ?? ''),
      eventTypeId: String(p['eventTypeId'] ?? p['categoryKey'] ?? ''),
      vendorId: p['vendorId'] as string | undefined,
      vendorName: p['vendorName'] as string | undefined,
      vendorDescription: p['vendorDescription'] as string | undefined,
      name: String(p['name'] ?? p['packageName'] ?? 'Package'),
      tier: String(p['theme'] ?? p['tier'] ?? ''),
      price: Number(p['price'] ?? p['basePrice'] ?? 0),
      description: String(p['description'] ?? ''),
      services: (p['services'] as string[]) ?? (p['inclusions'] as string[]) ?? [],
      maxGuests: Number(p['maxGuests'] ?? p['capacity'] ?? 0),
      durationHours: Number(p['durationHours'] ?? 0),
      isPopular: Boolean(p['isPopular']),
      image: resolveMediaUrl(p['image'] as string | undefined) ?? images[0],
      images,
      rating: Number(p['rating'] ?? 0),
      totalReviews: Number(p['totalReviews'] ?? 0),
      experience: p['experience'] as number | undefined,
      addons: (p['addons'] as EventPackage['addons']) ?? [],
      sustainabilityTags: (p['sustainabilityTags'] as string[]) ?? [],
      address: p['address'] as EventPackage['address'],
      pricing: p['pricing'] as EventPackage['pricing'],
      capacity: p['capacity'] as EventPackage['capacity'],
      policies: p['policies'] as EventPackage['policies'],
      spaces: p['spaces'] as EventPackage['spaces']
    };
  }
}
