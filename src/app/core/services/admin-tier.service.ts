import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface TierPriceRange {
  serviceName: string;
  minPrice: number;
  maxPrice: number;
}

export interface Tier {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  categoryGradient?: string;
  description?: string;
  isActive: boolean;
  icon?: string;
  gradient?: string;
  priceRanges: TierPriceRange[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTierRequest {
  name: string;
  categoryId: string;
  description?: string;
  isActive?: boolean;
  icon?: string;
  gradient?: string;
  priceRanges: TierPriceRange[];
}

export type UpdateTierRequest = Partial<CreateTierRequest>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminTierService {
  private http = inject(HttpClient);

  /** Base URL for admin tiers endpoints */
  private readonly base = `${environment.apiUrl}/admin/tiers`;

  // ── READ ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/tiers
   * Requires valid Admin JWT.
   */
  getAll(): Observable<Tier[]> {
    return this.http
      .get<ApiResponse<Tier[]>>(this.base)
      .pipe(map(res => res.data));
  }

  /**
   * GET /api/v1/admin/tiers/:id
   */
  getById(id: string): Observable<Tier> {
    return this.http
      .get<ApiResponse<Tier>>(`${this.base}/${id}`)
      .pipe(map(res => res.data));
  }

  /**
   * GET /api/v1/admin/tiers/by-category/:categoryId
   */
  getByCategoryId(categoryId: string): Observable<Tier[]> {
    return this.http
      .get<ApiResponse<Tier[]>>(`${this.base}/by-category/${categoryId}`)
      .pipe(map(res => res.data));
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/tiers
   */
  create(payload: CreateTierRequest): Observable<Tier> {
    return this.http
      .post<ApiResponse<Tier>>(this.base, payload)
      .pipe(map(res => res.data));
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  /**
   * PUT /api/v1/admin/tiers/:id
   */
  update(id: string, payload: UpdateTierRequest): Observable<Tier> {
    return this.http
      .put<ApiResponse<Tier>>(`${this.base}/${id}`, payload)
      .pipe(map(res => res.data));
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  /**
   * DELETE /api/v1/admin/tiers/:id
   */
  delete(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.base}/${id}`)
      .pipe(map(() => void 0));
  }

  // ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────

  /**
   * PATCH /api/v1/admin/tiers/:id/toggle-active
   */
  toggleActive(id: string, isActive: boolean): Observable<Tier> {
    return this.http
      .patch<ApiResponse<Tier>>(`${this.base}/${id}/toggle-active`, { isActive })
      .pipe(map(res => res.data));
  }
}
