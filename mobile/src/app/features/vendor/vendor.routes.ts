import { Routes } from '@angular/router';

/**
 * Vendor area. The five tabs are the jobs a vendor does daily; the rest —
 * finance, verification, B2B, offers, staff — sit behind the More tab.
 */
export const vendorRoutes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./vendor-tabs.page').then(m => m.VendorTabsPage),
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard.page').then(m => m.VendorDashboardPage) },
      { path: 'bookings', loadComponent: () => import('./bookings.page').then(m => m.VendorBookingsPage) },
      { path: 'packages', loadComponent: () => import('./packages.page').then(m => m.VendorPackagesPage) },
      { path: 'quote-board', loadComponent: () => import('./quote-board.page').then(m => m.VendorQuoteBoardPage) },
      { path: 'more', loadComponent: () => import('./more.page').then(m => m.VendorMorePage) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },

  { path: 'calendar', loadComponent: () => import('./calendar.page').then(m => m.VendorCalendarPage) },
  { path: 'package/new', loadComponent: () => import('./package-editor/package-editor.page').then(m => m.VendorPackageEditorPage) },
  { path: 'package/:id', loadComponent: () => import('./package-editor/package-editor.page').then(m => m.VendorPackageEditorPage) },
  { path: 'finance', loadComponent: () => import('./finance.page').then(m => m.VendorFinancePage) },
  { path: 'profile', loadComponent: () => import('./business-profile.page').then(m => m.VendorBusinessProfilePage) },
  { path: 'verification', loadComponent: () => import('./verification.page').then(m => m.VendorVerificationPage) },
  { path: 'messages', loadComponent: () => import('./messages.page').then(m => m.VendorMessagesPage) },
  { path: 'chat/:threadId', loadComponent: () => import('../customer/chat.page').then(m => m.ChatPage) },
  { path: 'notifications', loadComponent: () => import('../shared/notifications.page').then(m => m.NotificationsPage) },
  { path: 'settings', loadComponent: () => import('../shared/settings.page').then(m => m.SettingsPage) },

  { path: '', pathMatch: 'full', redirectTo: 'tabs/dashboard' }
];
