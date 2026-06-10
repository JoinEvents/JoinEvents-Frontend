import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CityInfo {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/locations`;

  getCities(): Observable<CityInfo[]> {
    return this.http.get<{ success: boolean, data: CityInfo[] }>(`${this.baseUrl}/cities`)
      .pipe(map(response => response.data || []));
  }
}
