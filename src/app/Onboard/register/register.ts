import { Component, signal } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { UserRole } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-register',
  imports: [RouterLink, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  step = signal(1);
  role = signal<UserRole>('customer');
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
  showCongregation = false;

  form = { name: '', email: '', phone: '', password: '', confirmPassword: '', businessName: '', city: '', agreeTerms: false, referralCode: '' };

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['ref']) {
        this.form.referralCode = params['ref'];
      }
    });
  }

  selectRole(r: UserRole) { this.role.set(r); }
  nextStep() { this.step.update(s => s + 1); }
  prevStep() { this.step.update(s => s - 1); }

  onSubmit() {
    if (!this.form.name || !this.form.email || !this.form.phone || !this.form.password) {
      this.toast.error('Please fill all required fields.');
      return;
    }
    if (this.form.password !== this.form.confirmPassword) {
      this.toast.error('Passwords do not match.');
      return;
    }

    this.isLoading = true;
    this.auth.register(this.form.name, this.form.email, this.form.phone, this.form.password, this.role(), this.form.referralCode).subscribe({
      next: (result) => {
        this.isLoading = false;
        if (!result.success) {
          this.toast.error(result.message);
        } else {
          if (this.form.referralCode) {
            this.showCongregation = true;
            setTimeout(() => {
              const path = this.role() === 'customer' ? '/dashboard' : `/${this.role()}/dashboard`;
              this.router.navigate([path]);
            }, 3500);
          } else {
            this.toast.success('Registration successful!');
            const path = this.role() === 'customer' ? '/dashboard' : `/${this.role()}/dashboard`;
            this.router.navigate([path]);
          }
        }
      },
      error: () => {
        this.toast.error('An error occurred during registration.');
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
