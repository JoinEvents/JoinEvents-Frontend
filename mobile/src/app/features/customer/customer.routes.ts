import { Routes } from '@angular/router';

/**
 * Customer area. Five tabs carry the primary journeys; everything else pushes
 * onto the stack of whichever tab it was opened from, so the back gesture
 * unwinds naturally.
 */
export const customerRoutes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./customer-tabs.page').then(m => m.CustomerTabsPage),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard.page').then(m => m.CustomerDashboardPage)
      },
      {
        path: 'events',
        loadComponent: () => import('./events.page').then(m => m.CustomerEventsPage)
      },
      {
        path: 'bookings',
        loadComponent: () => import('./bookings.page').then(m => m.CustomerBookingsPage)
      },
      {
        path: 'messages',
        loadComponent: () => import('./messages.page').then(m => m.CustomerMessagesPage)
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile.page').then(m => m.CustomerProfilePage)
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },

  // ---- Stacked detail pages -------------------------------------------
  { path: 'package/:id', loadComponent: () => import('./package-detail.page').then(m => m.PackageDetailPage) },
  { path: 'book/:packageId', loadComponent: () => import('./booking.page').then(m => m.CustomerBookingPage) },
  { path: 'checkout/:bookingId', loadComponent: () => import('./checkout.page').then(m => m.CheckoutPage) },
  { path: 'booking/:id', loadComponent: () => import('./booking-detail.page').then(m => m.BookingDetailPage) },
  { path: 'roshi', loadComponent: () => import('./roshi.page').then(m => m.RoshiPage) },
  { path: 'chat/:threadId', loadComponent: () => import('./chat.page').then(m => m.ChatPage) },
  { path: 'quotes', loadComponent: () => import('./quotes.page').then(m => m.CustomerQuotesPage) },
  { path: 'quotes/create', loadComponent: () => import('./create-quote.page').then(m => m.CreateQuotePage) },
  { path: 'quotes/edit/:id', loadComponent: () => import('./create-quote.page').then(m => m.CreateQuotePage) },
  { path: 'quotes/:id', loadComponent: () => import('./quote-detail.page').then(m => m.QuoteDetailPage) },
  { path: 'payments', loadComponent: () => import('./payments.page').then(m => m.CustomerPaymentsPage) },
  { path: 'rewards', loadComponent: () => import('./rewards.page').then(m => m.CustomerRewardsPage) },
  { path: 'favorites', loadComponent: () => import('./favorites.page').then(m => m.FavoritesPage) },
  { path: 'support', loadComponent: () => import('./support.page').then(m => m.CustomerSupportPage) },
  { path: 'notifications', loadComponent: () => import('../shared/notifications.page').then(m => m.NotificationsPage) },
  { path: 'settings', loadComponent: () => import('../shared/settings.page').then(m => m.SettingsPage) },

  { path: '', pathMatch: 'full', redirectTo: 'tabs/dashboard' }
];
