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

  get passwordScore(): number {
    const p = this.form.password;
    let score = 0;
    if (!p) return 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p)) score += 1;
    if (/[a-z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score += 1;
    return score;
  }

  get passwordStrengthColor(): string {
    const score = this.passwordScore;
    if (score === 0) return 'transparent'; 
    if (score <= 2) return 'var(--danger)'; 
    if (score <= 4) return 'var(--warning)'; 
    return 'var(--success)';
  }

  get passwordStrengthText(): string {
    const score = this.passwordScore;
    if (score === 0) return '';
    if (score <= 2) return 'Weak';
    if (score <= 4) return 'Fair';
    return 'Strong';
  }
  
  get passwordStrengthWidth(): string {
    return (this.passwordScore * 20) + '%';
  }

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['ref']) {
        this.form.referralCode = params['ref'];
      }
    });
  }

  selectRole(r: UserRole) { this.role.set(r); }
  nextStep() { 
    if (this.step() === 2) {
      if (!this.validateForm()) return;
    }
    this.step.update(s => s + 1); 
  }
  prevStep() { this.step.update(s => s - 1); }

  onPhoneInput(event: any) {
    let input = event.target.value;
    input = input.replace(/[^0-9]/g, '');
    this.form.phone = input;
    event.target.value = input;
  }

  validateForm(): boolean {
    if (!this.form.name || this.form.name.trim().length < 2) {
      this.toast.error('Name must be at least 2 characters.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.form.email || !emailRegex.test(this.form.email)) {
      this.toast.error('Please enter a valid email address.');
      return false;
    }

    const phoneRegex = /^\d{10}$/;
    if (!this.form.phone || !phoneRegex.test(this.form.phone)) {
      this.toast.error('Please enter a valid 10-digit phone number.');
      return false;
    }

    if (this.role() === 'vendor' && (!this.form.businessName || this.form.businessName.trim().length < 2)) {
      this.toast.error('Business name is required for vendors.');
      return false;
    }

    if (!this.form.city) {
      this.toast.error('Please select your city.');
      return false;
    }

    return true;
  }


  validatePassword(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one special character.';
    return null;
  }

  onSubmit() {
    if (!this.validateForm()) {
      this.step.set(2); // Go back to step 2 if somehow bypassed
      return;
    }
    
    if (this.form.password !== this.form.confirmPassword) {
      this.toast.error('Passwords do not match.');
      return;
    }

    const passwordError = this.validatePassword(this.form.password);
    if (passwordError) {
      this.toast.error(passwordError);
      return;
    }

    this.isLoading = true;
    this.auth.register(this.form.name, this.form.email, this.form.phone, this.form.password, this.role(), this.form.referralCode, this.form.city, this.form.businessName).subscribe({
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
