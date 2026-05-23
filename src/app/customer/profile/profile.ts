import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { MockApiService } from '../../core/services/mock-api.service';
import { ChangePasswordComponent } from '../../shared/components/change-password/change-password';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ChangePasswordComponent],
  templateUrl: './profile.html'
})
export class CustomerProfile implements OnInit {
  private auth = inject(AuthService);
  private api = inject(MockApiService);
  private dashboardService = inject(DashboardService);

  user = this.auth.currentUser;
  showPasswordModal = signal(false);
  loyaltyPoints = signal<number>(450);

  profileData = {
    name: this.user()?.name || '',
    email: this.user()?.email || '',
    phone: '+91 98765 43210',
    address: '123, Jubilee Hills, Hyderabad, Telangana',
    bio: 'Looking for the best event planners for my family functions.'
  };

  isEditing = signal(false);

  ngOnInit() {
    const user = this.auth.currentUser();
    const userId = user?.id ?? 'c1';

    if (userId && userId !== 'c1') {
      this.dashboardService.getCustomerProfile().subscribe(profile => {
        if (profile) {
          this.loyaltyPoints.set(profile.loyaltyPoints);
          this.profileData.phone = profile.phone || '';
          this.profileData.name = profile.name;
          this.profileData.email = profile.email;
        } else {
          this.loadMockProfile(userId);
        }
      });
    } else {
      this.loadMockProfile(userId);
    }
  }

  private loadMockProfile(userId: string) {
    this.api.getCustomers().subscribe(customers => {
      const customer = customers.find(c => c.id === userId);
      if (customer) {
        this.loyaltyPoints.set(customer.loyaltyPoints);
        this.profileData.phone = customer.phone || '+91 98765 43210';
        this.profileData.name = customer.name;
        this.profileData.email = customer.email;
      }
    });
  }

  saveProfile() {
    this.isEditing.set(false);
  }

  getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getLoyaltyTier(): string {
    const pts = this.loyaltyPoints();
    if (pts >= 1000) return 'Platinum Member';
    if (pts >= 400) return 'Gold Member';
    return 'Silver Member';
  }

  getTierIcon(): string {
    const pts = this.loyaltyPoints();
    if (pts >= 1000) return 'bi-gem';
    if (pts >= 400) return 'bi-award-fill';
    return 'bi-star-fill';
  }

  getTierColor(): string {
    const pts = this.loyaltyPoints();
    if (pts >= 1000) return '#E2E8F0';
    if (pts >= 400) return '#F59E0B';
    return '#94A3B8';
  }
}
