import { Component, signal, inject, Output, EventEmitter, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css'
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  ngOnInit() {
    document.body.classList.add('modal-open');
  }

  ngOnDestroy() {
    document.body.classList.remove('modal-open');
  }
  private toast = inject(ToastService);
  private profileService = inject(ProfileService);
  
  @Output() close = new EventEmitter<void>();

  passwordData = {
    current: '',
    new: '',
    confirm: ''
  };

  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);
  isLoading = signal(false);

  // Password strength scoring (same logic as registration)
  get passwordScore(): number {
    const p = this.passwordData.new;
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
    if (score <= 2) return 'var(--danger, #EF4444)';
    if (score <= 4) return 'var(--warning, #F59E0B)';
    return 'var(--success, #22C55E)';
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

  // Validation checks for showing requirement list
  get hasMinLength(): boolean { return this.passwordData.new.length >= 8; }
  get hasUppercase(): boolean { return /[A-Z]/.test(this.passwordData.new); }
  get hasLowercase(): boolean { return /[a-z]/.test(this.passwordData.new); }
  get hasNumber(): boolean { return /[0-9]/.test(this.passwordData.new); }
  get hasSpecialChar(): boolean { return /[!@#$%^&*(),.?":{}|<>]/.test(this.passwordData.new); }
  get passwordsMatch(): boolean { return this.passwordData.new === this.passwordData.confirm && this.passwordData.confirm.length > 0; }

  validatePassword(): string | null {
    if (!this.passwordData.current) return 'Please enter your current password.';
    if (this.passwordData.new.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(this.passwordData.new)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(this.passwordData.new)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(this.passwordData.new)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(this.passwordData.new)) return 'Password must contain at least one special character.';
    if (this.passwordData.new !== this.passwordData.confirm) return 'New passwords do not match.';
    if (this.passwordData.current === this.passwordData.new) return 'New password must be different from current password.';
    return null;
  }

  onSubmit() {
    const error = this.validatePassword();
    if (error) {
      this.toast.error(error);
      return;
    }

    this.isLoading.set(true);
    this.profileService.updatePassword(this.passwordData.current, this.passwordData.new).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.success) {
          this.toast.success('Password changed successfully! 🔒');
          this.close.emit();
        } else {
          this.toast.error(res?.error || 'Failed to update password. Please check your current password.');
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('An error occurred while updating the password.');
      }
    });
  }
}
