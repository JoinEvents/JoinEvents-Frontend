import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Shared HTTP plumbing for every feature service.
 *
 * Identical in shape to the web app's BaseApiService so that ported services
 * need no changes: same `X-Suppress-Errors` convention, same method signatures.
 */
@Injectable({ providedIn: 'root' })
export class BaseApiService {
  protected http = inject(HttpClient);
  protected baseUrl = environment.apiUrl;

  protected get<T>(url: string, params?: Record<string, unknown>, suppressErrors = true): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${url}`, {
      params: this.toParams(params),
      headers: this.headers(suppressErrors)
    });
  }

  protected post<T>(url: string, body: unknown, suppressErrors = true): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${url}`, body, { headers: this.headers(suppressErrors) });
  }

  protected put<T>(url: string, body: unknown, suppressErrors = true): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${url}`, body, { headers: this.headers(suppressErrors) });
  }

  protected patch<T>(url: string, body: unknown, suppressErrors = true): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${url}`, body, { headers: this.headers(suppressErrors) });
  }

  protected delete<T>(url: string, suppressErrors = true): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${url}`, { headers: this.headers(suppressErrors) });
  }

  private toParams(params?: Record<string, unknown>): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  /**
   * `X-Suppress-Errors` tells the error interceptor not to raise a toast for
   * this call, leaving the caller to render the failure inline.
   */
  private headers(suppressErrors: boolean): HttpHeaders {
    let headers = new HttpHeaders();
    if (suppressErrors) headers = headers.set('X-Suppress-Errors', 'true');
    return headers;
  }
}
