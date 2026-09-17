import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { AuthUser } from '../models/user.model';

const CUSTOMER: AuthUser = { id: 'u1', name: 'Test', email: 't@example.com', role: 'customer' };
const VENDOR: AuthUser = { id: 'u2', name: 'Vendor', email: 'v@example.com', role: 'vendor' };

function run<T>(fn: () => T): T {
  return TestBed.runInInjectionContext(fn);
}

describe('authGuard', () => {
  let auth: AuthService;
  let router: Router;
  const state = { url: '/customer/tabs/bookings' } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('sends an anonymous visitor to login, preserving where they were headed', () => {
    auth.currentUser.set(null);

    const result = run(() => authGuard('customer')(route, state));
    const tree = result as ReturnType<Router['createUrlTree']>;

    expect(router.serializeUrl(tree)).toContain('/auth/login');
    expect(router.serializeUrl(tree)).toContain('returnUrl');
  });

  it('admits a user whose role matches', () => {
    auth.currentUser.set(CUSTOMER);

    expect(run(() => authGuard('customer')(route, state))).toBe(true);
  });

  it('admits a user whose role is one of several allowed', () => {
    auth.currentUser.set(VENDOR);

    expect(run(() => authGuard(['customer', 'vendor'])(route, state))).toBe(true);
  });

  it('redirects a signed-in user away from an area their role cannot enter', () => {
    auth.currentUser.set(CUSTOMER);

    const result = run(() => authGuard('admin')(route, state));

    expect(router.serializeUrl(result as ReturnType<Router['parseUrl']>))
      .toBe('/customer/tabs/dashboard');
  });
});

describe('guestGuard', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('lets an anonymous visitor reach the auth screens', () => {
    auth.currentUser.set(null);

    expect(run(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBe(true);
  });

  it('bounces a signed-in vendor to their own home', () => {
    auth.currentUser.set(VENDOR);

    const result = run(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

    expect(router.serializeUrl(result as ReturnType<Router['parseUrl']>))
      .toBe('/vendor/tabs/dashboard');
  });
});
