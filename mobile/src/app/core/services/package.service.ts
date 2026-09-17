import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { EventPackage, EventType } from '../models/event.model';

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
    const query = {
      category: params.category,
      city: params.city,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      guests: params.guests,
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

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[]; items?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? payload?.items ?? []) as Record<string, unknown>[]);
  }

  private single(res: unknown): Record<string, unknown> {
    const payload = res as { data?: unknown } | null;
    return ((payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) ?? {}) as Record<string, unknown>;
  }

  private toEventType(c: Record<string, unknown>): EventType {
    return {
      id: String(c['categoryKey'] ?? c['id'] ?? ''),
      name: String(c['name'] ?? ''),
      nameHindi: c['nameHindi'] as string | undefined,
      description: String(c['description'] ?? ''),
      icon: String(c['icon'] ?? 'sparkles'),
      category: (c['categoryKey'] ?? c['category'] ?? 'custom') as EventType['category'],
      colorClass: (c['colorClass'] as string) ?? 'event-wedding',
      gradient: (c['gradient'] as string) ?? 'linear-gradient(135deg,#E91E8C,#FF6B6B)',
      startingPrice: Number(c['startingPrice'] ?? 0),
      popularServices: (c['popularServices'] as string[]) ?? []
    };
  }

  private toPackage(p: Record<string, unknown>): EventPackage {
    const images = (p['images'] as string[]) ?? [];
    return {
      id: String(p['id'] ?? p['packageId'] ?? ''),
      eventTypeId: String(p['eventTypeId'] ?? p['categoryKey'] ?? ''),
      vendorId: p['vendorId'] as string | undefined,
      vendorName: p['vendorName'] as string | undefined,
      vendorDescription: p['vendorDescription'] as string | undefined,
      name: String(p['name'] ?? p['packageName'] ?? 'Package'),
      tier: (String(p['tier'] ?? 'standard').toLowerCase() as EventPackage['tier']),
      price: Number(p['price'] ?? p['basePrice'] ?? 0),
      description: String(p['description'] ?? ''),
      services: (p['services'] as string[]) ?? (p['inclusions'] as string[]) ?? [],
      maxGuests: Number(p['maxGuests'] ?? p['capacity'] ?? 0),
      durationHours: Number(p['durationHours'] ?? 0),
      isPopular: Boolean(p['isPopular']),
      image: (p['image'] as string) ?? images[0],
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
