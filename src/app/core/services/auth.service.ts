import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { AuthUser, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

// [SECURITY] Mock users removed — hardcoded credentials must never ship in production bundles.

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  currentUser = signal<AuthUser | null>(this.loadFromStorage());

  /**
   * Checks whether a JWT token has expired by decoding its payload.
   * Returns true if the token is expired or malformed.
   * Includes a 30-second buffer to account for clock skew.
   */
  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true; // Not a valid JWT

      // Decode the payload (Base64Url → JSON)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      if (!payload.exp) return false; // No expiry claim — let backend decide

      // Compare with current time (exp is in seconds, Date.now() in ms)
      const bufferSeconds = 30;
      const nowInSeconds = Math.floor(Date.now() / 1000);
      return payload.exp < (nowInSeconds + bufferSeconds);
    } catch {
      // If token can't be decoded, treat as expired for safety
      return true;
    }
  }

  private loadFromStorage(): AuthUser | null {
    try {
      const stored = localStorage.getItem('joinevents_user');
      if (!stored) return null;
      
      const user = JSON.parse(stored);
      if (user.token && this.isTokenExpired(user.token)) {
        localStorage.removeItem('joinevents_user');
        return null;
      }
      return user;
    } catch { return null; }
  }

  /**
   * Validates that a return URL is safe for internal navigation.
   * Prevents open redirect attacks by ensuring the URL is a relative path.
   */
  private isValidReturnUrl(url: string): boolean {
    if (!url) return false;
    // Must start with a single slash (relative path)
    // Must NOT start with // (protocol-relative URL) or contain ://
    return url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
  }

  login(email: string, password: string, role: UserRole, returnUrl?: string): Observable<{ success: boolean; message: string }> {
    // Clear any existing session first
    localStorage.removeItem('joinevents_user');
    this.currentUser.set(null);

    return this.http.post<any>(`${this.apiUrl}/auth/login`, { email, password, role }).pipe(
      map(response => {
        if (response && response.token) {
          const user: AuthUser = {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user?.role || role,
            avatar: response.user?.avatar,
            token: response.token || response.AccessToken || response.accessToken
          };
          localStorage.setItem('joinevents_user', JSON.stringify(user));
          this.currentUser.set(user);
          
          // [SECURITY] Validate returnUrl to prevent open redirect attacks
          if (returnUrl && this.isValidReturnUrl(returnUrl)) {
            this.router.navigateByUrl(returnUrl);
          } else {
            const path = user.role === 'customer' ? '/dashboard' : `/${user.role}/dashboard`;
            this.router.navigate([path]);
          }
          return { success: true, message: 'Login successful!' };
        }
        return { success: false, message: 'Invalid response from server.' };
      }),
      catchError(error => {
        let msg = 'Login failed.';
        if (error.error && error.error.error) msg = error.error.error;
        else if (error.message) msg = error.message;
        return of({ success: false, message: msg });
      })
    );
  }

  register(name: string, email: string, phone: string, password: string, role: UserRole, referralCode?: string, city?: string, businessName?: string): Observable<{ success: boolean; message: string }> {
    localStorage.removeItem('joinevents_user');
    this.currentUser.set(null);

    return this.http.post<any>(`${this.apiUrl}/auth/register`, { name, email, phone, password, role, referralCode, city, businessName }).pipe(
      map(response => {
        if (response && response.token) {
          const user: AuthUser = {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user?.role || role,
            avatar: response.user?.avatar,
            token: response.token || response.AccessToken || response.accessToken
          };
          localStorage.setItem('joinevents_user', JSON.stringify(user));
          this.currentUser.set(user);
          return { success: true, message: 'Registration successful!' };
        }
        return { success: false, message: 'Invalid response from server.' };
      }),
      catchError(error => {
        let msg = 'Registration failed.';
        if (error.error && error.error.error) msg = error.error.error;
        else if (error.message) msg = error.message;
        return of({ success: false, message: msg });
      })
    );
  }

  socialLogin(token: string, provider: string): Observable<{ success: boolean; message: string }> {
    localStorage.removeItem('joinevents_user');
    this.currentUser.set(null);

    return this.http.post<any>(`${this.apiUrl}/auth/social-login`, { token, provider }).pipe(
      map(response => {
        if (response && response.token) {
          const user: AuthUser = {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user?.role || 'customer',
            avatar: response.user?.avatar,
            token: response.token || response.AccessToken || response.accessToken
          };
          localStorage.setItem('joinevents_user', JSON.stringify(user));
          this.currentUser.set(user);
          return { success: true, message: 'Login successful!' };
        }
        return { success: false, message: 'Invalid response from server.' };
      }),
      catchError(error => {
        let msg = 'Social login failed.';
        if (error.error && error.error.error) msg = error.error.error;
        else if (error.message) msg = error.message;
        return of({ success: false, message: msg });
      })
    );
  }

  /** [SECURITY] Server-side token invalidation + local cleanup */
  logout(): void {
    const token = this.currentUser()?.token;
    // Attempt server-side logout to invalidate the token
    if (token) {
      this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({
        error: () => { /* Logout API may not exist yet — fail silently */ }
      });
    }
    localStorage.removeItem('joinevents_user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /** Centralized method to update user profile in localStorage and signal */
  updateUserProfile(updates: Partial<AuthUser>): void {
    const current = this.currentUser();
    if (!current) return;
    const updated = { ...current, ...updates };
    localStorage.setItem('joinevents_user', JSON.stringify(updated));
    this.currentUser.set(updated);
  }

  isAuthenticated(): boolean { return this.currentUser() !== null; }
  getRole(): UserRole | null { return this.currentUser()?.role ?? null; }
  hasRole(role: UserRole): boolean { return this.currentUser()?.role === role; }
}
