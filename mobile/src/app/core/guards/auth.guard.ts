import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/**
 * Route guard factory matching the web app's `authGuard(role)` contract.
 * Accepts a single role or a list of allowed roles.
 */
export function authGuard(allowed: UserRole | UserRole[]): CanActivateFn {
  const roles = Array.isArray(allowed) ? allowed : [allowed];

  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
    }

    const role = auth.role();
    if (role && roles.includes(role)) return true;

    void toast.error('You do not have access to that area.');
    return router.parseUrl(auth.homeRoute());
  };
}

/** Keeps signed-in users out of the onboarding and login screens. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.parseUrl(auth.homeRoute()) : true;
};
