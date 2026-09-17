import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { StorageService } from './storage.service';

export interface CityInfo {
  id: string;
  name: string;
  state?: string;
  isPopular?: boolean;
}

const CITY_KEY = 'joinevents_city';

@Injectable({ providedIn: 'root' })
export class LocationService extends BaseApiService {
  private storage = inject(StorageService);

  readonly selectedCity = signal<string | null>(null);
  readonly cities = signal<CityInfo[]>([]);

  init(): void {
    this.selectedCity.set(this.storage.get(CITY_KEY));
  }

  setCity(city: string): void {
    this.selectedCity.set(city);
    this.storage.set(CITY_KEY, city);
  }

  getCities(): Observable<CityInfo[]> {
    if (this.cities().length) return of(this.cities());
    return this.get<unknown>(API_ROUTES.CITIES).pipe(
      map(res => this.unwrap(res).map(c => ({
        id: String(c['id'] ?? c['name'] ?? ''),
        name: String(c['name'] ?? ''),
        state: c['state'] as string | undefined,
        isPopular: Boolean(c['isPopular'])
      }))),
      tap(list => this.cities.set(list)),
      catchError(() => of([] as CityInfo[]))
    );
  }

  private unwrap(res: unknown): Record<string, unknown>[] {
    const payload = res as { data?: unknown[] } | unknown[] | null;
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    return ((payload?.data ?? []) as Record<string, unknown>[]);
  }
}
