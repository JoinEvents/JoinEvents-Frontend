import { Routes } from '@angular/router';

/** Admin console. Read-heavy oversight plus catalogue configuration. */
export const adminRoutes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./admin-tabs.page').then(m => m.AdminTabsPage),
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard.page').then(m => m.AdminDashboardPage) },
      { path: 'bookings', loadComponent: () => import('./bookings.page').then(m => m.AdminBookingsPage) },
      { path: 'directory', loadComponent: () => import('./directory.page').then(m => m.AdminDirectoryPage) },
      { path: 'catalogue', loadComponent: () => import('./catalogue.page').then(m => m.AdminCataloguePage) },
      { path: 'more', loadComponent: () => import('./more.page').then(m => m.AdminMorePage) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },

  // Catalogue editors: full-screen forms, 'new' or a record id.
  { path: 'catalogue/category/new', loadComponent: () => import('./catalogue/category-editor.page').then(m => m.AdminCategoryEditorPage) },
  { path: 'catalogue/category/:id', loadComponent: () => import('./catalogue/category-editor.page').then(m => m.AdminCategoryEditorPage) },
  { path: 'catalogue/tier/new', loadComponent: () => import('./catalogue/tier-editor.page').then(m => m.AdminTierEditorPage) },
  { path: 'catalogue/tier/:id', loadComponent: () => import('./catalogue/tier-editor.page').then(m => m.AdminTierEditorPage) },

  { path: 'audit', loadComponent: () => import('./audit.page').then(m => m.AdminAuditPage) },
  { path: 'verifications', loadComponent: () => import('../support/verifications.page').then(m => m.VerificationsPage) },
  { path: 'disputes', loadComponent: () => import('../support/reviews.page').then(m => m.ReviewModerationPage) },
  { path: 'notifications', loadComponent: () => import('../shared/notifications.page').then(m => m.NotificationsPage) },
  { path: 'settings', loadComponent: () => import('../shared/settings.page').then(m => m.SettingsPage) },

  { path: '', pathMatch: 'full', redirectTo: 'tabs/dashboard' }
];
