import { Component, signal, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface BreadcrumbItem {
  label: string;
  url: string;
  icon?: string;
}

const labelMap: Record<string, string> = {
  // Portals
  'admin': 'Admin Portal',
  'vendor': 'Vendor Portal',
  'support': 'Support Portal',
  'customer': 'Customer Portal',
  
  // Pages
  'dashboard': 'Dashboard',
  'bookings': 'Bookings',
  'customers': 'Customers',
  'vendors': 'Vendors',
  'employees': 'Employees',
  'categories': 'Categories',
  'profile': 'My Profile',
  'notifications': 'Notifications',
  'analytics': 'Analytics',
  'my-services': 'My Services',
  'add-service': 'Add Service',
  'edit-service': 'Edit Service',
  'services': 'Services',
  'calendar': 'Calendar',
  'verification': 'Verification',
  'network': 'Business Network',
  'impact': 'Impact Dashboard',
  'finance': 'Finance',
  'offers': 'Special Offers',
  'staff': 'Staff Management',
  'messages': 'Messages',
  'rfp': 'Global RFPs',
  'tickets': 'Support Tickets',
  'reviews': 'Reviews',
  'verifications': 'Verifications',
  'book': 'Book Package',
  'events': 'Events',
  'packages': 'Packages',
  'planner': 'Event Planner',
  'disputes': 'Disputes',
  'audit': 'Audit Trail',
  'users': 'Manage Users'
};

const iconMap: Record<string, string> = {
  'admin': 'bi-shield-lock',
  'vendor': 'bi-shop',
  'support': 'bi-headset',
  'dashboard': 'bi-grid-1x2',
  'bookings': 'bi-journal-check',
  'customers': 'bi-people',
  'vendors': 'bi-patch-check',
  'categories': 'bi-tag',
  'profile': 'bi-person-circle',
  'notifications': 'bi-bell',
  'analytics': 'bi-graph-up',
  'my-services': 'bi-card-list',
  'add-service': 'bi-plus-circle',
  'edit-service': 'bi-pencil-square',
  'tickets': 'bi-ticket-detailed',
  'messages': 'bi-chat-dots',
  'calendar': 'bi-calendar-event',
  'finance': 'bi-cash-stack',
  'staff': 'bi-people',
  'network': 'bi-globe'
};

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [],
  template: `
    @if (crumbs().length > 0) {
      <nav class="modern-breadcrumb" aria-label="breadcrumb">
        <ol class="breadcrumb-list">
          @for (crumb of crumbs(); track $index; let last = $last) {
            <li class="breadcrumb-item" [class.active]="last">
              @if (!last && crumb.url) {
                <a (click)="navigate(crumb.url, $event)" class="breadcrumb-link" style="cursor: pointer;">
                  @if (crumb.icon) {
                    <i class="bi {{ crumb.icon }} crumb-icon"></i>
                  }
                  <span class="crumb-label">{{ crumb.label }}</span>
                </a>
                <span class="breadcrumb-separator">
                  <i class="bi bi-chevron-right"></i>
                </span>
              } @else {
                <span class="breadcrumb-current">
                  @if (crumb.icon) {
                    <i class="bi {{ crumb.icon }} crumb-icon"></i>
                  }
                  <span class="crumb-label">{{ crumb.label }}</span>
                </span>
                @if (!last) {
                  <span class="breadcrumb-separator">
                    <i class="bi bi-chevron-right"></i>
                  </span>
                }
              }
            </li>
          }
        </ol>
      </nav>
    }
  `,
  styles: [`
    .modern-breadcrumb {
      display: flex;
      align-items: center;
      padding: 4px 0;
      margin-bottom: 16px;
      width: 100%;
      background: transparent;
      border: none;
      box-shadow: none;
    }

    .breadcrumb-list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 2px;
    }

    .breadcrumb-item {
      display: flex;
      align-items: center;
      font-size: 0.825rem;
      font-weight: 500;
      font-family: var(--font-body);
    }

    .breadcrumb-item::before {
      content: none !important;
    }

    .breadcrumb-link {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-soft);
      text-decoration: none;
      transition: color var(--transition);
      padding: 2px 4px;
      border-radius: var(--radius-sm);
    }

    .breadcrumb-link:hover {
      color: var(--primary);
    }

    .crumb-icon {
      font-size: 0.9rem;
    }

    .breadcrumb-separator {
      display: inline-flex;
      align-items: center;
      margin-left: 4px;
      margin-right: 4px;
      color: var(--text-soft);
      font-size: 0.6rem;
      opacity: 0.5;
    }

    .breadcrumb-current {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-main);
      font-weight: 600;
      cursor: default;
      padding: 2px 4px;
    }

    @media (max-width: 576px) {
      .modern-breadcrumb {
        margin-bottom: 12px;
      }
      .breadcrumb-item {
        font-size: 0.78rem;
      }
    }
  `]
})
export class BreadcrumbComponent {
  private router = inject(Router);
  crumbs = signal<BreadcrumbItem[]>([]);

  navigate(url: string, event: Event) {
    event.preventDefault();
    this.router.navigateByUrl(url);
  }

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe(() => {
      this.generateBreadcrumbs();
    });

    this.generateBreadcrumbs();
  }

  private isId(segment: string): boolean {
    if (!segment) return false;
    if (/^\d+$/.test(segment)) return true;
    if (/^[a-fA-F0-9-]{36}$/.test(segment)) return true;
    if (segment.length > 8 && /\d/.test(segment)) return true;
    return false;
  }

  private titleCase(text: string): string {
    if (!text) return '';
    return text
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getUrlForSegment(segment: string, cumulativePath: string, portalPrefix: string): string {
    if (segment === 'admin') return '/admin/dashboard';
    if (segment === 'vendor') return '/vendor/dashboard';
    if (segment === 'support') return '/support/dashboard';
    if (segment === 'book') return '/packages';
    if (segment === 'edit-service') {
      return portalPrefix ? `${portalPrefix}/my-services` : '/my-services';
    }
    return cumulativePath;
  }

  generateBreadcrumbs() {
    const urlTree = this.router.parseUrl(this.router.url);
    const urlPath = urlTree.root.children['primary'] ? urlTree.root.children['primary'].segments.map(it => it.path).join('/') : '';
    const queryParams = urlTree.queryParams;

    const cleanUrl = '/' + urlPath.replace(/\/$/, '');
    const dashboardUrls = ['', '/dashboard', '/admin/dashboard', '/vendor/dashboard', '/support/dashboard', '/admin', '/vendor', '/support'];
    
    if (dashboardUrls.includes(cleanUrl)) {
      this.crumbs.set([]);
      return;
    }

    const segments = urlPath.split('/').filter(s => s);
    const crumbsList: BreadcrumbItem[] = [];

    let cumulativePath = '';
    let portalPrefix = '';

    if (segments.length > 0 && ['admin', 'vendor', 'support'].includes(segments[0])) {
      portalPrefix = '/' + segments[0];
    }

    const isCustomerPortal = !portalPrefix && !['login', 'register', 'forgot-password', 'partner-login'].includes(segments[0] || '');
    if (isCustomerPortal && segments[0] !== 'dashboard') {
      crumbsList.push({
        label: 'Dashboard',
        url: '/dashboard',
        icon: 'bi-house-door'
      });
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      cumulativePath += '/' + segment;

      const parentSegment = i > 0 ? segments[i - 1] : undefined;
      const isSegmentId = this.isId(segment);

      let label = '';
      if (isSegmentId) {
        if (parentSegment === 'book') {
          label = 'Package Details';
        } else if (parentSegment === 'edit-service') {
          label = 'Edit Details';
        } else {
          label = 'Details';
        }
      } else {
        label = labelMap[segment] || this.titleCase(segment);
      }

      let finalUrl = this.getUrlForSegment(segment, cumulativePath, portalPrefix);

      if (isSegmentId) {
        finalUrl = '';
      }

      const icon = iconMap[segment];

      // If this is the 'vendors' segment on the customer portal, and we have a query parameter like ?wedding
      if (segment === 'vendors' && parentSegment === 'events' && !portalPrefix) {
        const queryKeys = Object.keys(queryParams);
        if (queryKeys.length > 0) {
          const eventType = queryKeys[0];
          const packageId = queryParams[eventType];
          
          if (packageId && typeof packageId === 'string' && packageId.startsWith('pkg_')) {
            crumbsList.push({
              label: `${this.titleCase(eventType)} Vendors`,
              url: `/events/vendors?${eventType}`,
              icon: icon
            });
            crumbsList.push({
              label: 'Details',
              url: '',
              icon: ''
            });
          } else {
            crumbsList.push({
              label: `${this.titleCase(eventType)} Vendors`,
              url: '', // terminal crumb
              icon: icon
            });
          }
          continue; // Skip adding the raw 'Vendors' crumb
        }
      }

      crumbsList.push({
        label,
        url: finalUrl,
        icon
      });
    }

    this.crumbs.set(crumbsList);
  }
}
