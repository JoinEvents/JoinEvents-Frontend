import { Component, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { ChangePasswordComponent } from '../../shared/components/change-password/change-password';
import { AvatarCropperComponent } from '../../shared/components/avatar-cropper';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ChangePasswordComponent, AvatarCropperComponent],
  templateUrl: './profile.html'
})
export class CustomerProfile implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private toast = inject(ToastService);

  user = this.auth.currentUser;
  showPasswordModal = signal(false);
  showDeleteModal = signal(false);
  loyaltyPoints = signal<number>(0);

  constructor() {
    effect(() => {
      document.body.classList.toggle('modal-open', this.showDeleteModal());
    });
  }

  ngOnDestroy() {
    document.body.classList.remove('modal-open');
  }

  profileData = {
    name: this.user()?.name || '',
    email: this.user()?.email || '',
    phone: '',
    address: '',
    bio: '',
    emailNotifications: true,
    inAppNotifications: true,
    smsNotifications: false
  };

  isEditing = signal(false);

  ngOnInit() {
    this.profileService.getProfile().subscribe(profile => {
      if (profile) {
        this.loyaltyPoints.set(profile.loyaltyPoints || 0);
        this.profileData.phone = profile.phone || '';
        this.profileData.name = profile.name || this.user()?.name || '';
        this.profileData.email = profile.email || this.user()?.email || '';
        this.profileData.address = profile.address || '';
        this.profileData.bio = profile.bio || '';
        this.profileData.emailNotifications = profile.emailNotifications ?? true;
        this.profileData.inAppNotifications = profile.inAppNotifications ?? true;
        this.profileData.smsNotifications = profile.smsNotifications ?? false;
      }
    });
  }

  updateNotificationSetting(key: 'emailNotifications' | 'inAppNotifications' | 'smsNotifications', event: any) {
    const value = event.target.checked;
    this.profileData[key] = value;
    this.profileService.updateProfile({ [key]: value }).subscribe({
      next: (res) => {
        if (res) {
          this.toast.success('Notification settings updated! 🔔');
        } else {
          this.toast.error('Failed to update notification settings.');
          event.target.checked = !value;
          this.profileData[key] = !value;
        }
      },
      error: () => {
        this.toast.error('An error occurred while updating settings.');
        event.target.checked = !value;
        this.profileData[key] = !value;
      }
    });
  }

  saveProfile() {
    this.profileService.updateProfile(this.profileData).subscribe({
      next: (res) => {
        if (res) {
          this.isEditing.set(false);
          this.toast.success('Profile updated successfully! ✨');
          const currentUser = this.auth.currentUser();
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              name: res.name || currentUser.name,
              email: res.email || currentUser.email,
              avatar: res.avatar || currentUser.avatar
            };
            localStorage.setItem('joinevents_user', JSON.stringify(updatedUser));
            this.auth.currentUser.set(updatedUser);
          }
        } else {
          this.toast.error('Failed to update profile. Please try again.');
        }
      },
      error: () => {
        this.toast.error('An error occurred while saving your profile.');
      }
    });
  }

  getInitials(name: string) {
    if (!name) return '';
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

  deleteAccount() {
    this.showDeleteModal.set(true);
  }

  confirmDeleteAccount() {
    this.showDeleteModal.set(false);
    this.profileService.deleteAccount().subscribe({
      next: (res) => {
        if (res?.success) {
          this.toast.success('Your account has been successfully deleted.');
          this.auth.logout();
        } else {
          this.toast.error(res?.error || 'Failed to delete account. Please try again.');
        }
      },
      error: () => {
        this.toast.error('An error occurred while deleting your account.');
      }
    });
  }
}
