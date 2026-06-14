import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export function authGuard(requiredRole: UserRole | UserRole[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // [SECURITY] Check both authentication state and token validity
    if (!auth.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    // Verify the stored token hasn't expired (re-check on each navigation)
    const user = auth.currentUser();
    if (user?.token) {
      try {
        const parts = user.token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp) {
            const nowInSeconds = Math.floor(Date.now() / 1000);
            if (payload.exp < nowInSeconds) {
              // Token expired — force re-login
              auth.logout();
              router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
              return false;
            }
          }
        }
      } catch {
        // Token decode failed — force re-login for safety
        auth.logout();
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
    }

    const userRole = auth.getRole();
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (userRole && !roles.includes(userRole)) {
      const target = userRole === 'customer' ? '/dashboard' : `/${userRole}/dashboard`;
      router.navigate([target]);
      return false;
    }
    return true;
  };
}
