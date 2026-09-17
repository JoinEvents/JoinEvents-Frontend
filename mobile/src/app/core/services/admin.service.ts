import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';

export interface AdminOverview {
  totalCustomers: number;
  totalVendors: number;
  pendingVerifications: number;
  totalBookings: number;
  grossBookingValue: number;
  platformRevenue: number;
  openDisputes: number;
  activePackages: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService extends BaseApiService {
  getOverview(): Observable<AdminOverview | null> {
    return this.get<unknown>(API_ROUTES.ADMIN_DIRECTORY.ANALYTICS, undefined, false).pipe(
      map(res => this.single<AdminOverview>(res)),
      catchError(() => of(null))
    );
  }

  getCustomers(search?: string): Observable<Record<string, unknown>[]> {
    return this.get<unknown>(API_ROUTES.ADMIN_DIRECTORY.CUSTOMERS, { search }, false).pipe(
      map(res => this.unwrap(res)),
      catchError(() => of([]))
    );
  }

  getVendors(search?: string): Observable<Record<string, unknown>[]> {
    return this.get<unknown>(API_ROUTES.ADMIN_DIRECTORY.VENDORS, { search }, false).pipe(
      map(res => this.unwrap(res)),
      catchError(() => of([]))
    );
  }

  getEmployees(): Observable<Record<string, unknown>[]> {
    return this.listOf(API_ROUTES.ADMIN_DIRECTORY.EMPLOYEES);
  }

  getAuditLogs(): Observable<Record<string, unknown>[]> {
    return this.listOf(API_ROUTES.ADMIN_DIRECTORY.AUDIT);
  }

  // ---- catalogue configuration -------------------------------------------

  getCategories(): Observable<Record<string, unknown>[]> {
    return this.listOf(API_ROUTES.EVENT_CATEGORIES);
  }

  createCategory(payload: Record<string, unknown>): Observable<boolean> {
    return this.ok(this.post<unknown>(API_ROUTES.EVENT_CATEGORIES, payload, false));
  }

  updateCategory(id: string, payload: Record<string, unknown>): Observable<boolean> {
    return this.ok(this.put<unknown>(`${API_ROUTES.EVENT_CATEGORIES}/${id}`, payload, false));
  }

  deleteCategory(id: string): Observable<boolean> {
    return this.ok(this.delete<unknown>(`${API_ROUTES.EVENT_CATEGORIES}/${id}`, false));
  }

  toggleCategory(id: string, isActive: boolean): Observable<boolean> {
    return this.ok(this.patch<unknown>(`${API_ROUTES.EVENT_CATEGORIES}/${id}/status`, { isActive }, false));
  }

  getTiers(): Observable<Record<string, unknown>[]> {
    return this.listOf('/tiers');
  }

  createTier(payload: Record<string, unknown>): Observable<boolean> {
    return this.ok(this.post<unknown>('/tiers', payload, false));
  }

  updateTier(id: string, payload: Record<string, unknown>): Observable<boolean> {
    return this.ok(this.put<unknown>(`/tiers/${id}`, payload, false));
  }

  deleteTier(id: string): Observable<boolean> {
    return this.ok(this.delete<unknown>(`/tiers/${id}`, false));
  }

  /** Everything the admin home screen needs, joined so one failure is contained. */
  getDashboardBundle(): Observable<{
    overview: AdminOverview | null;
    pendingVendors: Record<string, unknown>[];
    auditLogs: Record<string, unknown>[];
  }> {
    return forkJoin({
      overview: this.getOverview(),
      pendingVendors: this.get<unknown>(API_ROUTES.SUPPORT.PENDING_VENDORS, undefined, false).pipe(
        map(res => this.unwrap(res)),
        catchError(() => of([]))
      ),
      auditLogs: this.getAuditLogs()
    });
  }

  private listOf<T = Record<string, unknown>>(url: string): Observable<T[]> {
    return this.get<unknown>(url, undefined, false).pipe(
      map(res => this.unwrap(res) as unknown as T[]),
      catchError(() => of([] as T[]))
    );
  }

  private ok(source: Observable<unknown>): Observable<boolean> {
    return source.pipe(map(() => true), catchError(() => of(false)));
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? []) as Record<string, unknown>[]);
  }

  private single<T>(res: unknown): T | null {
    const payload = res as { data?: unknown } | null;
    const value = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return (value as T) ?? null;
  }
}
