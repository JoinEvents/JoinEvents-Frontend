import { Routes } from '@angular/router'; 
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./Onboard/get-start/get-start').then(m => m.GetStart), pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./Onboard/login/login').then(m => m.Login) },
  { path: 'partner-login', loadComponent: () => import('./Onboard/portal-login/portal-login').then(m => m.PortalLogin) },
  { path: 'register', loadComponent: () => import('./Onboard/register/register').then(m => m.Register) },
  { path: 'forgot-password', loadComponent: () => import('./Onboard/forgot-password/forgot-password').then(m => m.ForgotPassword) },

  {
    path: '',
    loadComponent: () => import('./customer/layout/customer-layout').then(m => m.CustomerLayout),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./customer/dashboard/dashboard').then(m => m.CustomerDashboard), canActivate: [authGuard('customer')] },
      { path: 'book/:packageId', loadComponent: () => import('./customer/booking/booking').then(m => m.CustomerBooking), canActivate: [authGuard(['customer', 'vendor'])] },
      { path: 'checkout/:packageId', loadComponent: () => import('./customer/checkout/checkout').then(m => m.Checkout), canActivate: [authGuard(['customer', 'vendor'])] },
      { path: 'events', loadComponent: () => import('./customer/events/events').then(m => m.CustomerEvents) },
      { path: 'events/vendors', loadComponent: () => import('./customer/vendors/customer-vendors').then(m => m.CustomerVendors), canActivate: [authGuard(['customer', 'vendor'])] },
      { path: 'packages', loadComponent: () => import('./customer/packages/packages').then(m => m.CustomerPackages) },
      { path: 'planner', loadComponent: () => import('./customer/event-planner/event-planner').then(m => m.EventPlanner), canActivate: [authGuard('customer')] },
      { path: 'rfp', loadComponent: () => import('./customer/rfp/customer-rfp').then(m => m.CustomerRfp), canActivate: [authGuard('customer')] },
      { path: 'bookings', loadComponent: () => import('./customer/my-bookings/my-bookings').then(m => m.MyBookings), canActivate: [authGuard('customer')] },
      { path: 'messages', loadComponent: () => import('./customer/messages/messages').then(m => m.CustomerMessages), canActivate: [authGuard('customer')] },
      { path: 'payments', loadComponent: () => import('./customer/payments/payments').then(m => m.CustomerPayments), canActivate: [authGuard('customer')] },
      { path: 'profile', loadComponent: () => import('./customer/profile/profile').then(m => m.CustomerProfile), canActivate: [authGuard('customer')] },
      { path: 'support', loadComponent: () => import('./customer/support/support').then(m => m.CustomerSupport), canActivate: [authGuard('customer')] },
      { path: 'notifications', loadComponent: () => import('./shared/pages/notifications/notifications').then(m => m.NotificationsPage), canActivate: [authGuard('customer')] },
    ]
  },

  {
    path: 'vendor',
    loadComponent: () => import('./vendor/layout/vendor-layout').then(m => m.VendorLayout),
    canActivate: [authGuard('vendor')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./vendor/dashboard/vendor-dashboard').then(m => m.VendorDashboard) },
      { path: 'my-services', loadComponent: () => import('./vendor/my-services/my-services').then(m => m.VendorMyServices) },
      { path: 'add-service', loadComponent: () => import('./vendor/add-service/add-service').then(m => m.VendorAddService) },
      { path: 'edit-service/:id', loadComponent: () => import('./vendor/add-service/add-service').then(m => m.VendorAddService) },
      { path: 'services', loadComponent: () => import('./vendor/my-services/my-services').then(m => m.VendorMyServices) },
      { path: 'calendar', loadComponent: () => import('./vendor/calendar/vendor-calendar').then(m => m.VendorCalendar) },
      { path: 'bookings', loadComponent: () => import('./vendor/bookings/vendor-bookings').then(m => m.VendorBookings) },
      { path: 'verification', loadComponent: () => import('./vendor/verification/vendor-verification').then(m => m.VendorVerification) },
      { path: 'profile', loadComponent: () => import('./vendor/profile/profile').then(m => m.VendorProfile) },
      { path: 'network', loadComponent: () => import('./vendor/network/vendor-network').then(m => m.VendorNetwork) },
      { path: 'impact', loadComponent: () => import('./vendor/impact/vendor-impact').then(m => m.VendorImpact) },
      { path: 'finance', loadComponent: () => import('./vendor/finance/vendor-finance').then(m => m.VendorFinance) },
      { path: 'offers', loadComponent: () => import('./vendor/offers/vendor-offers').then(m => m.VendorOffers) },
      { path: 'staff', loadComponent: () => import('./vendor/staff/vendor-staff').then(m => m.VendorStaff) },
      { path: 'messages', loadComponent: () => import('./vendor/messages/messages').then(m => m.VendorMessages) },
      { path: 'rfp', loadComponent: () => import('./vendor/rfp/vendor-rfp').then(m => m.VendorRfp) },
      { path: 'notifications', loadComponent: () => import('./shared/pages/notifications/notifications').then(m => m.NotificationsPage) },
      { path: 'analytics', loadComponent: () => import('./vendor/analytics/vendor-analytics').then(m => m.VendorAnalytics) },
    ]
  },

  {
    path: 'admin',
    loadComponent: () => import('./admin/layout/admin-layout').then(m => m.AdminLayout),
    canActivate: [authGuard('admin')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./admin/dashboard/admin-dashboard').then(m => m.AdminDashboard) },
      { path: 'bookings', loadComponent: () => import('./admin/bookings/admin-bookings').then(m => m.AdminBookings) },
      { path: 'customers', loadComponent: () => import('./admin/customers/admin-customers').then(m => m.AdminCustomers) },
      { path: 'vendors', loadComponent: () => import('./admin/vendors/admin-vendors').then(m => m.AdminVendors) },
      { path: 'employees', loadComponent: () => import('./admin/employees/admin-employees').then(m => m.AdminEmployees) },
      { path: 'categories', loadComponent: () => import('./admin/categories/admin-categories').then(m => m.AdminCategories) },
      { path: 'profile', loadComponent: () => import('./admin/profile/profile').then(m => m.AdminProfile) },
      { path: 'notifications', loadComponent: () => import('./shared/pages/notifications/notifications').then(m => m.NotificationsPage) },
      { path: 'analytics', loadComponent: () => import('./admin/analytics/admin-analytics').then(m => m.AdminAnalytics) },
    ]
  },
  {
    path: 'support',
    loadComponent: () => import('./support/layout/support-layout').then(m => m.SupportLayout),
    canActivate: [authGuard('support')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./support/dashboard/support-dashboard').then(m => m.SupportDashboard) },
      { path: 'tickets', loadComponent: () => import('./support/support/admin-support').then(m => m.AdminSupport) },
      { path: 'bookings', loadComponent: () => import('./support/bookings/support-bookings').then(m => m.SupportBookings) },
      { path: 'customers', loadComponent: () => import('./admin/customers/admin-customers').then(m => m.AdminCustomers) },
      { path: 'vendors', loadComponent: () => import('./admin/vendors/admin-vendors').then(m => m.AdminVendors) },
      { path: 'reviews', loadComponent: () => import('./support/reviews/admin-reviews').then(m => m.AdminReviews) },
      { path: 'verifications', loadComponent: () => import('./support/verifications/admin-verifications').then(m => m.AdminVerifications) },
      { path: 'profile', loadComponent: () => import('./support/profile/support-profile').then(m => m.SupportProfile) },
    ]
  },

  { path: '**', loadComponent: () => import('./shared/pages/not-found/not-found').then(m => m.NotFoundPage) }
];
