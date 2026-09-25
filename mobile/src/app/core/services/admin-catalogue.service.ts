import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import {
  CatalogueResult, CategoryPayload, EventCategory, Tier, TierPayload
} from '../models/catalogue.model';
import { serverMessage } from '../utils/server-message.util';

/**
 * Admin CRUD for event categories and pricing tiers, against the same
 * /admin/* endpoints the web console uses. The public /event-categories and
 * /tiers endpoints only return active records and accept no writes, so they
 * cannot back an admin screen.
 *
 * Every call passes the server's own message back on failure — the API
 * explains conflicts (e.g. a duplicate category key) in words an admin can act on.
 */
@Injectable({ providedIn: 'root' })
export class AdminCatalogueService extends BaseApiService {
  private readonly routes = API_ROUTES.ADMIN_CATALOGUE;

  /**
   * Bumped after every successful write. The list screen lives inside the tab
   * outlet, which gets no ionViewWillEnter when an editor pushed on top of the
   * tabs is popped — so it reloads on this instead.
   */
  readonly version = signal(0);

  // ---- categories ------------------------------------------------------

  getCategories(): Observable<CatalogueResult<EventCategory[]>> {
    return this.list<EventCategory>(this.routes.CATEGORIES, 'Could not load categories.');
  }

  createCategory(payload: CategoryPayload): Observable<CatalogueResult<EventCategory>> {
    return this.write(this.post<unknown>(this.routes.CATEGORIES, payload), 'Could not create the category.');
  }

  updateCategory(id: string, payload: Partial<CategoryPayload>): Observable<CatalogueResult<EventCategory>> {
    return this.write(this.put<unknown>(this.routes.CATEGORY(id), payload), 'Could not save the category.');
  }

  deleteCategory(id: string): Observable<CatalogueResult<null>> {
    return this.write(this.delete<unknown>(this.routes.CATEGORY(id)), 'Could not delete the category.');
  }

  toggleCategory(id: string, isActive: boolean): Observable<CatalogueResult<EventCategory>> {
    return this.write(this.patch<unknown>(this.routes.CATEGORY_TOGGLE(id), { isActive }), 'Could not change the status.');
  }

  // ---- tiers -----------------------------------------------------------

  getTiers(): Observable<CatalogueResult<Tier[]>> {
    return this.list<Tier>(this.routes.TIERS, 'Could not load tiers.');
  }

  createTier(payload: TierPayload): Observable<CatalogueResult<Tier>> {
    return this.write(this.post<unknown>(this.routes.TIERS, payload), 'Could not create the tier.');
  }

  updateTier(id: string, payload: Partial<TierPayload>): Observable<CatalogueResult<Tier>> {
    return this.write(this.put<unknown>(this.routes.TIER(id), payload), 'Could not save the tier.');
  }

  deleteTier(id: string): Observable<CatalogueResult<null>> {
    return this.write(this.delete<unknown>(this.routes.TIER(id)), 'Could not delete the tier.');
  }

  toggleTier(id: string, isActive: boolean): Observable<CatalogueResult<Tier>> {
    return this.write(this.patch<unknown>(this.routes.TIER_TOGGLE(id), { isActive }), 'Could not change the status.');
  }

  // ---- plumbing --------------------------------------------------------

  private list<T>(url: string, fallback: string): Observable<CatalogueResult<T[]>> {
    return this.get<unknown>(url).pipe(
      map(res => ({ data: (this.payload(res) as T[] | null) ?? [] })),
      catchError(err => of({ error: serverMessage(err, fallback) }))
    );
  }

  private write<T>(request$: Observable<unknown>, fallback: string): Observable<CatalogueResult<T>> {
    return request$.pipe(
      tap(() => this.version.update(v => v + 1)),
      map(res => ({ data: this.payload(res) as T })),
      catchError(err => of({ error: serverMessage(err, fallback) }))
    );
  }

  /** The API wraps records as { success, data, message }. */
  private payload(res: unknown): unknown {
    return res && typeof res === 'object' && 'data' in res ? (res as { data: unknown }).data : res;
  }
}
