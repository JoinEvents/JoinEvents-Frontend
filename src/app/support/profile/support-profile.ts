import { Component, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { ChangePasswordComponent } from '../../shared/components/change-password/change-password';
import { AvatarCropperComponent } from '../../shared/components/avatar-cropper';

@Component({
  selector: 'app-support-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ChangePasswordComponent, AvatarCropperComponent],
  templateUrl: './support-profile.html',
  styleUrl: './support-profile.css'
})
export class SupportProfile implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private toast = inject(ToastService);
  user = this.auth.currentUser;
  showPasswordModal = signal(false);
  showDeleteModal = signal(false);

  constructor() {
    effect(() => {
      document.body.classList.toggle('modal-open', this.showDeleteModal());
    });
  }

  ngOnDestroy() {
    document.body.classList.remove('modal-open');
  }

  profileData: any = {
    name: this.user()?.name || '',
    email: this.user()?.email || '',
    role: '',
    department: '',
    employeeId: '',
    shift: '',
    lastLogin: '',
    emailNotifications: true,
    inAppNotifications: true,
    smsNotifications: false
  };

  isEditing = signal(false);

  ngOnInit() {
    this.profileService.getProfile().subscribe(profile => {
      if (profile) {
        this.profileData = { ...this.profileData, ...profile };
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
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  deleteAccount() {
    this.showDeleteModal.set(true);
  }

  confirmDeleteAccount() {
    this.showDeleteModal.set(false);
    this.profileService.deleteAccount().subscribe({
      next: (res) => {
        if (res?.success) {
          this.toast.success('Your support account has been successfully deleted.');
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
