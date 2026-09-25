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
