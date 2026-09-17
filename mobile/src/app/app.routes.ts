import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Route tree mirroring the web app's information architecture, reshaped for
 * mobile: each role gets a tab shell, and the deep pages (package detail,
 * checkout, chat, ticket detail) push onto the active tab's stack so the back
 * gesture returns to where the user came from.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth/get-started' },

  // ---- Onboarding & authentication ------------------------------------
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: 'get-started', loadComponent: () => import('./features/auth/get-started.page').then(m => m.GetStartedPage) },
      { path: 'login', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
      { path: 'partner-login', loadComponent: () => import('./features/auth/partner-login.page').then(m => m.PartnerLoginPage) },
      { path: 'register', loadComponent: () => import('./features/auth/register.page').then(m => m.RegisterPage) },
      { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password.page').then(m => m.ForgotPasswordPage) },
      { path: '', pathMatch: 'full', redirectTo: 'get-started' }
    ]
  },

  // ---- Customer --------------------------------------------------------
  {
    path: 'customer',
    canActivate: [authGuard('customer')],
    loadChildren: () => import('./features/customer/customer.routes').then(m => m.customerRoutes)
  },

  // ---- Vendor ----------------------------------------------------------
  {
    path: 'vendor',
    canActivate: [authGuard('vendor')],
    loadChildren: () => import('./features/vendor/vendor.routes').then(m => m.vendorRoutes)
  },

  // ---- Admin -----------------------------------------------------------
  {
    path: 'admin',
    canActivate: [authGuard('admin')],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes)
  },

  // ---- Support agent ----------------------------------------------------
  {
    path: 'support',
    canActivate: [authGuard('support')],
    loadChildren: () => import('./features/support/support.routes').then(m => m.supportRoutes)
  },

  { path: '**', loadComponent: () => import('./features/shared/not-found.page').then(m => m.NotFoundPage) }
];
