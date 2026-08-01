import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { CustomerProfile } from '../../core/models/user.model';
import { ConfirmService } from '../../shared/components/confirm-dialog';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './admin-customers.html',
  styleUrl: './admin-customers.css'
})
export class AdminCustomers implements OnInit {
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  isAdmin = computed(() => this.auth.getRole() === 'admin');
  
  customers = signal<CustomerProfile[]>([]);
  searchQuery = signal('');
  statusFilter = signal('all');

  // Moderation state
  moderatingCustomer = signal<CustomerProfile | null>(null);
  moderationAction = signal<'warn' | 'restrict' | 'suspend' | 'ban' | ''>('');
  moderationReason = signal('');
  moderationDuration = signal('1_week');

  ngOnInit() {
    this.loadCustomers();
  }

  loadCustomers() {
    this.http.get<CustomerProfile[]>(`${environment.apiUrl}/admin/users/customers`).subscribe(data => {
      this.customers.set(data || []);
    });
  }

  private moderateCustomer(customerId: string, action: 'warn' | 'restrict' | 'suspend' | 'ban' | 'reactivate', reason?: string, duration?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/admin/users/customers/${customerId}/moderate`, {
      action,
      reason,
      duration
    }).pipe(
      tap(() => this.loadCustomers())
    );
  }

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
