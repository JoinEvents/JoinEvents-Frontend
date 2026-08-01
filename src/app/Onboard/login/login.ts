import { Component, signal, OnInit, HostListener } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private router = inject(Router);

  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  returnUrl = '';
  rememberMe = false;

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';
    this.checkOAuthCallback();
    const rememberedEmail = localStorage.getItem('joinevents_remember_email');
    const isRemembered = localStorage.getItem('joinevents_remember_me') === 'true';
    if (isRemembered && rememberedEmail) {
      this.email = rememberedEmail;
      this.rememberMe = true;
    } else {
      this.email = '';
    }
    this.password = '';
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.toast.error('Please fill all fields.');
      return;
    }
    this.isLoading = true;
    this.auth.login(this.email, this.password, 'customer', this.returnUrl).subscribe({
      next: (result) => {
        if (!result.success) {
          this.toast.error(result.message);
        } else {
          this.toast.success('Login successful!');
          if (this.rememberMe) {
            localStorage.setItem('joinevents_remember_email', this.email);
            localStorage.setItem('joinevents_remember_me', 'true');
          } else {
            localStorage.removeItem('joinevents_remember_email');
            localStorage.removeItem('joinevents_remember_me');
          }
        }
        this.isLoading = false;
      },
      error: () => {
        this.toast.error('An error occurred during login.');
        this.isLoading = false;
      }
    });
  }

  loginWithSocial(provider: string) {
    const redirectUri = encodeURIComponent(window.location.origin + '/login');
    let oauthUrl = '';

    if (provider === 'Google') {
      const clientId = environment.googleClientId;
      if (clientId === 'YOUR_GOOGLE_CLIENT_ID' || !clientId) {
        this.toast.error('Google Client ID is not configured in environment.');
        return;
      }
      oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=openid%20profile%20email&state=google`;
    } else if (provider === 'Facebook') {
      const appId = environment.facebookAppId;
      if (appId === 'YOUR_FACEBOOK_APP_ID' || !appId) {
        this.toast.error('Facebook App ID is not configured in environment.');
        return;
      }
      oauthUrl = `https://www.facebook.com/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=token&scope=email,public_profile&state=facebook`;
    } else {
      this.toast.error(`Unsupported provider: ${provider}`);
      return;
    }

    this.toast.info(`Redirecting to ${provider}...`);
    window.location.href = oauthUrl;
  }

  checkOAuthCallback() {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const state = params.get('state');

      if (accessToken && state) {
        // Clear the hash from address bar
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        const provider = state.toLowerCase() === 'google' ? 'Google' : 'Facebook';
        this.handleSocialLogin(accessToken, provider);
      }
    }
  }

  handleSocialLogin(token: string, provider: string) {
    this.toast.info(`Connecting account via ${provider}...`);
    this.isLoading = true;
    this.auth.socialLogin(token, provider).subscribe({
      next: (result) => {
        if (!result.success) {
          this.toast.error(result.message);
        } else {
          this.toast.success(`Successfully authenticated via ${provider}.`);
          const path = this.auth.getRole() === 'customer' ? '/dashboard' : `/${this.auth.getRole()}/dashboard`;
          this.router.navigate([path]);
        }
        this.isLoading = false;
      },
      error: () => {
        this.toast.error(`An error occurred during registration via ${provider}.`);
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
