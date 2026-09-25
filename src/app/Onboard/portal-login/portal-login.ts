import { Component, signal, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-portal-login',
  imports: [RouterLink, FormsModule],
  templateUrl: './portal-login.html',
  styleUrl: './portal-login.css'
})
export class PortalLogin implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  selectedRole = signal<UserRole>('vendor');
  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  returnUrl = '';

  readonly roles: { role: UserRole; label: string; icon: string; color: string }[] = [
    { role: 'vendor',   label: 'Vendor',   icon: 'bi-shop',         color: '#6B21A8' },
    { role: 'admin',    label: 'Admin',    icon: 'bi-shield-check',  color: '#0EA5E9' },
    { role: 'support',  label: 'Support',  icon: 'bi-headset',       color: '#F59E0B' },
  ];

  selectRole(role: UserRole) {
    this.selectedRole.set(role);
    this.email = '';
    this.password = '';
  }

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';
    this.email = '';
    this.password = '';
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.toast.error('Please fill all fields.');
      return;
    }
    this.isLoading = true;
    this.auth.login(this.email, this.password, this.selectedRole(), this.returnUrl).subscribe({
      next: (result) => {
        if (!result.success) {
          this.toast.error(result.message);
        }
        this.isLoading = false;
      },
      error: () => {
        this.toast.error('An error occurred during login.');
        this.isLoading = false;
      }
    });
  }

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    if (img.nextElementSibling) {
      (img.nextElementSibling as HTMLElement).style.display = 'block';
    }
  }
}
