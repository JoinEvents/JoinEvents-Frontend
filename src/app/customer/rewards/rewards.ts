import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoyaltyService, LoyaltyBalance } from '../../core/services/loyalty.service';
import { LoyaltyTransaction } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-customer-rewards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rewards.html',
  styleUrls: ['./rewards.css']
})
export class CustomerRewards implements OnInit {
  private loyaltyService = inject(LoyaltyService);
  private authService = inject(AuthService);

  balance = signal<LoyaltyBalance | null>(null);
  history = signal<LoyaltyTransaction[]>([]);
  loading = signal<boolean>(true);

  showReferModal = signal<boolean>(false);
  showCongratsModal = signal<boolean>(false);
  submittingReferral = signal<boolean>(false);
  referralError = signal<string | null>(null);
  linkCopied = signal<boolean>(false);

  ngOnInit() {
    this.loadRewardsData();
  }

  openReferModal() {
    this.showReferModal.set(true);
    this.referralError.set(null);
    this.linkCopied.set(false);
  }

  closeReferModal() {
    this.showReferModal.set(false);
  }

  closeCongratsModal() {
    this.showCongratsModal.set(false);
    this.loadRewardsData();
  }

  getReferralLink(): string {
    const user = this.authService.currentUser();
    if (!user) return 'http://localhost:4200/register';
    const cleanId = user.id.replace(/^(usr_)/, '');
    return `http://localhost:4200/register?ref=${cleanId.slice(0, 8)}`;
  }

  copyReferralLink() {
    const link = this.getReferralLink();
    navigator.clipboard.writeText(link).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  submitReferral(event: Event, email: string) {
    event.preventDefault();
    if (!email || !email.includes('@')) {
      this.referralError.set('Please enter a valid email address');
      return;
    }

    const user = this.authService.currentUser();
    if (!user) return;

    this.submittingReferral.set(true);
    this.referralError.set(null);

    this.loyaltyService.referFriend(user.id, email).subscribe({
      next: (res) => {
        this.submittingReferral.set(false);
        this.showReferModal.set(false);
        
        if (this.balance()) {
          this.balance.set({
            points: res.newBalance ?? res.NewBalance ?? 0,
            tier: res.newTier ?? res.NewTier ?? 'Bronze',
            pointsToNextTier: this.balance()?.pointsToNextTier
          });
        }
        
        this.showCongratsModal.set(true);
        setTimeout(() => this.createConfetti(), 100);
      },
      error: (err) => {
        console.error('Failed to submit referral', err);
        this.referralError.set(err.error?.message || err.error || 'Failed to submit referral. Please try again.');
        this.submittingReferral.set(false);
      }
    });
  }

  createConfetti() {
    const existing = document.querySelector('.confetti-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#ff6b35', '#ff8c42', '#EAB308', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'];
    const shapes = ['square', 'circle', 'triangle'];

    for (let i = 0; i < 150; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      
      const left = Math.random() * 100;
      const delay = Math.random() * 2;
      const duration = 2.5 + Math.random() * 2;
      const size = 8 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      piece.style.left = `${left}%`;
      piece.style.animationDelay = `${delay}s`;
      piece.style.animationDuration = `${duration}s`;
      piece.style.width = `${size}px`;
      piece.style.height = `${size}px`;
      piece.style.backgroundColor = color;
      
      if (shape === 'circle') {
        piece.style.borderRadius = '50%';
      } else if (shape === 'triangle') {
        piece.style.width = '0';
        piece.style.height = '0';
        piece.style.backgroundColor = 'transparent';
        piece.style.borderLeft = `${size/2}px solid transparent`;
        piece.style.borderRight = `${size/2}px solid transparent`;
        piece.style.borderBottom = `${size}px solid ${color}`;
      }

      container.appendChild(piece);
    }

    setTimeout(() => {
      container.remove();
    }, 6000);
  }

  private loadRewardsData() {
    const user = this.authService.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    // Call APIs
    this.loyaltyService.getBalance(user.id).subscribe({
      next: (bal) => {
        this.balance.set(bal);
        // Also fetch history
        this.loyaltyService.getHistory(user.id).subscribe({
          next: (hist) => {
            this.history.set(hist);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load transaction history', err);
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Failed to load loyalty balance', err);
        this.loading.set(false);
      }
    });
  }
}
