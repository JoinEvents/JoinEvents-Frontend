// TODO: Replace MockApiService with real AdminCustomerService when backend endpoints exist
// Currently uses local in-memory fallback since no backend customer CRUD or moderation endpoints exist yet
import { Component, signal, computed, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { of, Observable } from 'rxjs';
import { CustomerProfile } from '../../core/models/user.model';
import { ConfirmService } from '../../shared/components/confirm-dialog';
import { AuthService } from '../../core/services/auth.service';

@Component({ selector: 'app-admin-customers', standalone: true, imports: [TitleCasePipe], templateUrl: './admin-customers.html', styleUrl: './admin-customers.css' })
export class AdminCustomers {
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);

  isAdmin = computed(() => this.auth.getRole() === 'admin');
  
  customers = signal<CustomerProfile[]>([
    { id: 'c1', name: 'Rajesh Kumar', email: 'customer@demo.com', phone: '+91 98765 43210', city: 'Hyderabad', totalBookings: 3, totalSpent: 546700, joinedDate: '2025-09-01', accountStatus: 'active', role: 'customer', loyaltyPoints: 450, strikes: 0 },
    { id: 'c2', name: 'Sunita Patel', email: 'sunita@demo.com', phone: '+91 97654 32109', city: 'Bangalore', totalBookings: 1, totalSpent: 265300, joinedDate: '2026-03-10', accountStatus: 'active', role: 'customer', loyaltyPoints: 120, strikes: 0 },
    { id: 'c3', name: 'Anand Reddy', email: 'anand@demo.com', phone: '+91 96543 21098', city: 'Chennai', totalBookings: 2, totalSpent: 307500, joinedDate: '2026-01-15', accountStatus: 'warning', role: 'customer', loyaltyPoints: 200, strikes: 1, suspensionReason: 'Frequent cancellations' },
    { id: 'c4', name: 'Meena Sharma', email: 'meena@demo.com', phone: '+91 95432 10987', city: 'Mumbai', totalBookings: 0, totalSpent: 0, joinedDate: '2026-04-18', accountStatus: 'active', role: 'customer', loyaltyPoints: 0, strikes: 0 },
  ]);

  searchQuery = signal('');
  statusFilter = signal('all');

  private moderateCustomer(customerId: string, action: 'warn' | 'restrict' | 'suspend' | 'ban' | 'reactivate', reason?: string, duration?: string): Observable<boolean> {
    this.customers.update(customers => 
      customers.map(c => {
        if (c.id === customerId) {
          let status = c.accountStatus;
          let strikes = c.strikes || 0;

          if (action === 'warn') {
            status = 'warning';
            strikes++;
          } else if (action === 'restrict') {
            status = 'restricted';
          } else if (action === 'suspend') {
            status = 'suspended';
          } else if (action === 'ban') {
            status = 'banned';
          } else if (action === 'reactivate') {
            status = 'active';
            strikes = 0;
          }

          return { 
            ...c, 
            accountStatus: status as any,
            strikes,
            suspensionReason: action !== 'reactivate' ? reason : undefined,
            suspensionDuration: action === 'suspend' ? duration : undefined
          };
        }
        return c;
      })
    );
    return of(true);
  }

  // Moderation state
  moderatingCustomer = signal<CustomerProfile | null>(null);
  moderationAction = signal<'warn' | 'restrict' | 'suspend' | 'ban' | ''>('');
  moderationReason = signal('');
  moderationDuration = signal('1_week');

  filteredCustomers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();
    
    return this.customers().filter(c => {
      const matchesSearch = !query || 
        c.name.toLowerCase().includes(query) || 
        c.email.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query)) ||
        c.city.toLowerCase().includes(query);
        
      const matchesFilter = filter === 'all' || 
        (filter === 'active' && c.accountStatus === 'active') ||
        (filter === 'warning' && c.accountStatus === 'warning') ||
        (filter === 'restricted' && c.accountStatus === 'restricted') ||
        (filter === 'suspended' && c.accountStatus === 'suspended') ||
        (filter === 'banned' && c.accountStatus === 'banned');
        
      return matchesSearch && matchesFilter;
    });
  });

  openModerationForm(customer: CustomerProfile, action: 'warn' | 'restrict' | 'suspend' | 'ban') {
    this.moderatingCustomer.set(customer);
    this.moderationAction.set(action);
    this.moderationReason.set('');
    this.moderationDuration.set('1_week');
  }

  cancelModeration() {
    this.moderatingCustomer.set(null);
    this.moderationAction.set('');
  }

  confirmModeration() {
    const c = this.moderatingCustomer();
    const action = this.moderationAction();
    if (c && action && this.moderationReason().trim()) {
      this.moderateCustomer(c.id, action, this.moderationReason(), this.moderationDuration()).subscribe(() => {
        this.cancelModeration();
      });
    }
  }

  async reactivateCustomer(customer: CustomerProfile) {
    const confirmed = await this.confirm.ask({
      title: 'Reactivate Customer',
      message: `Are you sure you want to restore active status for ${customer.name}? All strikes will be reset.`,
      confirmText: 'Reactivate',
      type: 'primary'
    });
    if (confirmed) {
      this.moderateCustomer(customer.id, 'reactivate').subscribe();
    }
  }

  statusColor(s: string): string { 
    const m: Record<string,string> = { 
      active: 'ee-badge-success', 
      warning: 'ee-badge-warning', 
      restricted: 'ee-badge-info', 
      suspended: 'ee-badge-danger', 
      banned: 'ee-badge-dark' 
    }; 
    return m[s] || 'ee-badge-primary'; 
  }
}
