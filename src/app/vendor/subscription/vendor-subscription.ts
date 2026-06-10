import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionService } from '../../core/services/subscription.service';
import { SubscriptionTierConfig, SUBSCRIPTION_TIERS } from '../../core/models/subscription.model';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-vendor-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vendor-subscription.html',
  styleUrl: './vendor-subscription.css'
})
export class VendorSubscription implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  tiers = SUBSCRIPTION_TIERS;
  billingCycle = signal<'monthly' | 'yearly'>('monthly');
  isUpgrading = signal(false);
  isLoading = signal(true);
  showConfirmModal = signal(false);
  selectedUpgradeTier = signal<SubscriptionTierConfig | null>(null);

  currentTier = computed(() => {
    const sub = this.subscriptionService.currentSubscription();
    return sub?.tier || 'free';
  });

  ngOnInit() {
    // Fetch current subscription from backend
    this.subscriptionService.getSubscription().subscribe(() => {
      this.isLoading.set(false);
    });
  }

  getPrice(tier: SubscriptionTierConfig): number {
    return this.billingCycle() === 'yearly' ? tier.priceYearly : tier.priceMonthly;
  }

  getSavings(tier: SubscriptionTierConfig): number {
    if (tier.priceMonthly === 0) return 0;
    return (tier.priceMonthly * 12) - tier.priceYearly;
  }

  isCurrentTier(tier: SubscriptionTierConfig): boolean {
    return tier.tier === this.currentTier();
  }

  isUpgrade(tier: SubscriptionTierConfig): boolean {
    const order = ['free', 'pro', 'premium'];
    return order.indexOf(tier.tier) > order.indexOf(this.currentTier() as string);
  }

  initiateUpgrade(tier: SubscriptionTierConfig) {
    this.selectedUpgradeTier.set(tier);
    this.showConfirmModal.set(true);
  }

  confirmUpgrade() {
    const tier = this.selectedUpgradeTier();
    if (!tier) return;

    this.isUpgrading.set(true);

    // Send upgrade request to backend — backend handles payment & activation
    this.subscriptionService.upgradeTier(tier.tier, this.billingCycle()).subscribe({
      next: () => {
        this.isUpgrading.set(false);
        this.showConfirmModal.set(false);
        this.toast.success(`Successfully upgraded to ${tier.name}! Welcome aboard.`);
      },
      error: () => {
        this.isUpgrading.set(false);
        this.toast.error('Upgrade failed. Please try again or contact support.');
      }
    });
  }

  cancelUpgrade() {
    this.showConfirmModal.set(false);
    this.selectedUpgradeTier.set(null);
  }
}
