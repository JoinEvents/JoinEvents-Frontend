import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { AuthUser, UserRole } from '../models/user.model';

const MOCK_USERS: Record<string, AuthUser & { password: string }> = {
  'user@test.com':     { id: 'c1', name: 'Test User',     email: 'user@test.com',     role: 'customer', phone: '9999999999', password: 'JoinEvents@2025', token: '' },
  'vendor@test.com':   { id: 'v1', name: 'Vendor Owner',  email: 'vendor@test.com',   role: 'vendor',   phone: '8888888888', password: 'JoinEvents@2025', token: '' },
  'admin@test.com':    { id: 'a1', name: 'Priya Nair',    email: 'admin@test.com',    role: 'admin',    phone: '9988776655', password: 'JoinEvents@2025', token: '' },
  'support@test.com':  { id: 's1', name: 'Rahul Support', email: 'support@test.com',  role: 'support',  phone: '9900011223', password: 'JoinEvents@2025', token: '' },
  // Legacy demo aliases kept for backward compatibility
  'customer@demo.com': { id: 'c1', name: 'Rajesh Kumar',  email: 'customer@demo.com', role: 'customer', phone: '+91 98765 43210', password: 'JoinEvents@2025', token: '' },
  'vendor@demo.com':   { id: 'v1', name: 'Amit Sharma',   email: 'vendor@demo.com',   role: 'vendor',   phone: '+91 91234 56789', password: 'JoinEvents@2025', token: '' },
  'admin@demo.com':    { id: 'a1', name: 'Priya Nair',    email: 'admin@demo.com',    role: 'admin',    phone: '+91 99887 76655', password: 'JoinEvents@2025', token: '' },
};

import { environment } from '../../../environments/environment';
 
@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  currentUser = signal<AuthUser | null>(this.loadFromStorage());

  private isTokenExpired(token: string): boolean {
    return false; // Bypassed: tokens do not automatically expire on frontend
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
            token: response.token || response.AccessToken || response.accessToken
          };
          localStorage.setItem('joinevents_user', JSON.stringify(user));
          this.currentUser.set(user);
          
          if (returnUrl) {
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

  register(name: string, email: string, phone: string, password: string, role: UserRole, referralCode?: string): Observable<{ success: boolean; message: string }> {
    localStorage.removeItem('joinevents_user');
    this.currentUser.set(null);

    return this.http.post<any>(`${this.apiUrl}/auth/register`, { name, email, phone, password, role, referralCode }).pipe(
      map(response => {
        if (response && response.token) {
          const user: AuthUser = {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user?.role || role,
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

  logout(): void {
    localStorage.removeItem('joinevents_user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean { return this.currentUser() !== null; }
  getRole(): UserRole | null { return this.currentUser()?.role ?? null; }
  hasRole(role: UserRole): boolean { return this.currentUser()?.role === role; }
}
