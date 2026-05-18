import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ── Models ────────────────────────────────────────────────────────────────────

export interface EventCategory {
  id: string;             // server-assigned UUID / int
  name: string;           // Display name  e.g. "Wedding"
  nameHindi?: string;     // Hindi label   e.g. "Shaadi"
  categoryKey: string;    // Auto-slug     e.g. "wedding"  (derived from name)
  icon: string;           // Bootstrap icon class e.g. "bi-hearts"
  gradient?: string;      // CSS gradient for card header
  colorClass?: string;    // CSS utility class
  startingPrice?: number; // Lowest price in this category
  description?: string;
  popularServices?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryRequest {
  name: string;
  nameHindi?: string;
  categoryKey: string;      // auto-generated slug sent to API
  icon: string;
  gradient?: string;
  colorClass?: string;
  startingPrice?: number;
  description?: string;
  popularServices?: string[];
  isActive?: boolean;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminCategoryService {
  private http = inject(HttpClient);

  /** Base URL for admin event-category endpoints */
  private readonly base = `${environment.apiUrl}/admin/event-categories`;

  // ── READ ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/event-categories
   * Requires valid Admin JWT — sent automatically by the auth interceptor.
   */
  getAll(): Observable<EventCategory[]> {
    return this.http
      .get<ApiResponse<EventCategory[]>>(this.base)
      .pipe(map(res => res.data));
  }

  /**
   * GET /api/v1/admin/event-categories/:id
   * Returns a single category by ID.
   */
  getById(id: string): Observable<EventCategory> {
    return this.http
      .get<ApiResponse<EventCategory>>(`${this.base}/${id}`)
      .pipe(map(res => res.data));
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/event-categories
   * Body: CreateCategoryRequest
   */
  create(payload: CreateCategoryRequest): Observable<EventCategory> {
    return this.http
      .post<ApiResponse<EventCategory>>(this.base, payload)
      .pipe(map(res => res.data));
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  /**
   * PUT /api/v1/admin/event-categories/:id
   * Body: UpdateCategoryRequest (partial)
   */
  update(id: string, payload: UpdateCategoryRequest): Observable<EventCategory> {
    return this.http
      .put<ApiResponse<EventCategory>>(`${this.base}/${id}`, payload)
      .pipe(map(res => res.data));
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  /**
   * DELETE /api/v1/admin/event-categories/:id
   */
  delete(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.base}/${id}`)
      .pipe(map(() => void 0));
  }

  // ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────

  /**
   * PATCH /api/v1/admin/event-categories/:id/toggle-active
   * Activates or deactivates a category without deleting it.
   */
  toggleActive(id: string, isActive: boolean): Observable<EventCategory> {
    return this.http
      .patch<ApiResponse<EventCategory>>(`${this.base}/${id}/toggle-active`, { isActive })
      .pipe(map(res => res.data));
  }

  // ── UTILITY ───────────────────────────────────────────────────────────────

  /**
   * Converts a display name to a URL-safe slug key.
   * "Wedding Photography" → "wedding_photography"
   */
  static toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_]/g, '')
      .replace(/\s+/g, '_');
  }
}
