import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { PackageAddress } from '../utils/package-draft.util';

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
  address: Partial<PackageAddress>;
}

/**
 * Address search and reverse lookup against OpenStreetMap Nominatim — the
 * service the web console's package form uses — plus the device's own
 * location. Everything it returns only pre-fills fields the vendor can edit.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);
  private readonly base = 'https://nominatim.openstreetmap.org';

  search(query: string): Observable<PlaceSuggestion[]> {
    if (query.trim().length < 3) return of([]);
    const params = new HttpParams()
      .set('format', 'json').set('addressdetails', '1').set('limit', '6').set('q', query.trim());
    return this.http.get<NominatimPlace[]>(`${this.base}/search`, { params }).pipe(
      map(results => (results ?? []).map(toSuggestion)),
      catchError(() => of([]))
    );
  }

  reverse(lat: number, lng: number): Observable<PlaceSuggestion | null> {
    const params = new HttpParams()
      .set('format', 'json').set('addressdetails', '1').set('zoom', '18')
      .set('lat', String(lat)).set('lon', String(lng));
    return this.http.get<NominatimPlace>(`${this.base}/reverse`, { params }).pipe(
      map(result => (result?.address ? toSuggestion(result) : null)),
      catchError(() => of(null))
    );
  }

  /** The device's position; rejects with a message the vendor can act on. */
  currentPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Location is not available on this device.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(new Error(err.code === err.PERMISSION_DENIED
          ? 'Allow location access for JoinEvents in your phone settings, then try again.'
          : 'Could not get your location. Check that location is switched on.')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }
}

interface NominatimPlace {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
}

/** Maps Nominatim's address parts onto the package address fields (same mapping as the web form). */
function toSuggestion(place: NominatimPlace): PlaceSuggestion {
  const a = place.address ?? {};
  return {
    label: place.display_name ?? '',
    lat: Number(place.lat),
    lng: Number(place.lon),
    address: {
      country: a['country'] ?? '',
      state: a['state'] ?? '',
      city: a['city'] ?? a['town'] ?? a['municipality'] ?? a['county'] ?? '',
      locality: a['suburb'] ?? a['neighbourhood'] ?? a['village'] ?? a['quarter'] ?? '',
      street: a['road'] ?? a['pedestrian'] ?? '',
      pincode: a['postcode'] ?? ''
    }
  };
}
