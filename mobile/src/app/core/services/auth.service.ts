import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { AuthUser, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { resolveMediaUrl } from '../utils/media-url.util';

export interface AuthResult {
  success: boolean;
  message: string;
}

interface LoginResponse {
  token?: string;
  AccessToken?: string;
  accessToken?: string;
  user?: { id: string; name: string; email: string; role?: UserRole; avatar?: string; phone?: string };
}

const USER_KEY = 'joinevents_user';

/** Landing route per role, mirroring the web app's post-login redirect. */
export const ROLE_HOME: Record<UserRole, string> = {
  customer: '/customer/tabs/dashboard',
  vendor: '/vendor/tabs/dashboard',
  admin: '/admin/tabs/dashboard',
  support: '/support/tabs/dashboard'
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private storage = inject(StorageService);
  private apiUrl = environment.apiUrl;

  readonly currentUser = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly role = computed<UserRole | null>(() => this.currentUser()?.role ?? null);

  /**
   * Restores the session from device storage. Called once from APP_INITIALIZER
   * after StorageService.hydrate(), so guards can read the session synchronously.
   */
  restoreSession(): void {
    const user = this.storage.getObject<AuthUser>(USER_KEY);
    if (!user) return;
    if (user.token && this.isTokenExpired(user.token)) {
      this.storage.remove(USER_KEY);
      return;
    }
    this.currentUser.set(user);
  }

  getToken(): string | null {
    return this.currentUser()?.token ?? null;
  }

  hasRole(role: UserRole): boolean {
    return this.currentUser()?.role === role;
  }

  login(email: string, password: string, role: UserRole): Observable<AuthResult> {
    this.clearSession();
    const normalizedEmail = this.normalizeEmail(email);
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email: normalizedEmail, password, role }).pipe(
      map(response => this.acceptSession(response, role, 'Login successful!')),
      catchError(error => of(this.toFailure(error, 'Login failed.')))
    );
  }

  register(payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    referralCode?: string;
    city?: string;
    businessName?: string;
  }): Observable<AuthResult> {
    this.clearSession();
    const normalizedPayload = { ...payload, email: this.normalizeEmail(payload.email) };
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/register`, normalizedPayload).pipe(
      map(response => this.acceptSession(response, payload.role, 'Registration successful!')),
      catchError(error => of(this.toFailure(error, 'Registration failed.')))
    );
  }

  socialLogin(token: string, provider: string): Observable<AuthResult> {
    this.clearSession();
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/social-login`, { token, provider }).pipe(
      map(response => this.acceptSession(response, 'customer', 'Login successful!')),
      catchError(error => of(this.toFailure(error, 'Social login failed.')))
    );
  }

  requestPasswordReset(email: string): Observable<AuthResult> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.http.post<{ message?: string }>(`${this.apiUrl}/auth/forgot-password`, { email: normalizedEmail }).pipe(
      map(res => ({ success: true, message: res?.message || 'Reset link sent to your email.' })),
      catchError(error => of(this.toFailure(error, 'Could not send the reset link.')))
    );
  }

  resetPassword(email: string, otp: string, newPassword: string): Observable<AuthResult> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.http.post<{ message?: string }>(`${this.apiUrl}/auth/reset-password`, { email: normalizedEmail, otp, newPassword }).pipe(
      map(res => ({ success: true, message: res?.message || 'Password updated.' })),
      catchError(error => of(this.toFailure(error, 'Could not reset the password.')))
    );
  }

  /** Registers the device's push token against the signed-in account. */
  registerDeviceToken(token: string, platform: 'ios' | 'android'): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/profile/device-token`, { token, platform }).pipe(
      tap(() => this.storage.set('joinevents_device_token', token)),
      catchError(() => of(null))
    );
  }

  /** Invalidates the token server-side where supported, then clears locally. */
  logout(): void {
    if (this.getToken()) {
      this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({ error: () => void 0 });
    }
    this.clearSession();
    void this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  updateUserProfile(updates: Partial<AuthUser>): void {
    const current = this.currentUser();
    if (!current) return;
    const updated = { ...current, ...updates };
    this.storage.setObject(USER_KEY, updated);
    this.currentUser.set(updated);
  }

  homeRoute(): string {
    const role = this.role();
    return role ? ROLE_HOME[role] : '/auth/login';
  }

  // ---- internals -------------------------------------------------------

  private acceptSession(response: LoginResponse, fallbackRole: UserRole, successMessage: string): AuthResult {
    const token = response?.token || response?.AccessToken || response?.accessToken;
    if (!token || !response.user) {
      return { success: false, message: 'Invalid response from server.' };
    }
    const user: AuthUser = {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      phone: response.user.phone,
      role: response.user.role || fallbackRole,
      avatar: resolveMediaUrl(response.user.avatar),
      token
    };
    this.storage.setObject(USER_KEY, user);
    this.currentUser.set(user);
    return { success: true, message: successMessage };
  }

  /**
   * Mobile keyboards can auto-capitalize the first letter of an email field,
   * and stray leading/trailing whitespace is easy to pick up from autofill.
   * Normalizing here means a slightly different keystroke between the
   * register screen and the login screen can never turn into a false
   * "invalid credentials" — every call site gets this for free.
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private clearSession(): void {
    this.storage.remove(USER_KEY);
    this.currentUser.set(null);
  }

  private toFailure(error: unknown, fallback: string): AuthResult {
    const err = error as { error?: { error?: string; message?: string }; message?: string };
    const message = err?.error?.error || err?.error?.message || err?.message || fallback;
    return { success: false, message };
  }

  /**
   * Decodes a JWT payload to check expiry, with a 30 second buffer for clock
   * skew. A malformed token counts as expired so a bad session cannot linger.
   */
  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
      if (!payload.exp) return false;
      return payload.exp < Math.floor(Date.now() / 1000) + 30;
    } catch {
      return true;
    }
  }
}
