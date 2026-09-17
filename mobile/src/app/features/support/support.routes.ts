import { Routes } from '@angular/router';

/** Support agent console: tickets, verification queue, booking monitor, moderation. */
export const supportRoutes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./support-tabs.page').then(m => m.SupportTabsPage),
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard.page').then(m => m.SupportDashboardPage) },
      { path: 'tickets', loadComponent: () => import('./tickets.page').then(m => m.SupportTicketsPage) },
      { path: 'verifications', loadComponent: () => import('./verifications.page').then(m => m.VerificationsPage) },
      { path: 'bookings', loadComponent: () => import('../admin/bookings.page').then(m => m.AdminBookingsPage) },
      { path: 'more', loadComponent: () => import('./more.page').then(m => m.SupportMorePage) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },

  { path: 'ticket/:id', loadComponent: () => import('./ticket-detail.page').then(m => m.TicketDetailPage) },
  { path: 'reviews', loadComponent: () => import('./reviews.page').then(m => m.ReviewModerationPage) },
  { path: 'directory', loadComponent: () => import('../admin/directory.page').then(m => m.AdminDirectoryPage) },
  { path: 'notifications', loadComponent: () => import('../shared/notifications.page').then(m => m.NotificationsPage) },
  { path: 'settings', loadComponent: () => import('../shared/settings.page').then(m => m.SettingsPage) },

  { path: '', pathMatch: 'full', redirectTo: 'tabs/dashboard' }
];
