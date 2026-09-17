/**
 * JoinEvents Vendor Subscription Model
 *
 * Defines subscription tiers that provide predictable recurring revenue
 * and create vendor lock-in through feature differentiation.
 */

export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface VendorSubscription {
  vendorId: string;
  tier: SubscriptionTier;
  priceMonthly: number;
  priceYearly: number;
  maxActiveListings: number;
  featuredListings: number;
  prioritySupport: boolean;
  analyticsAccess: 'basic' | 'advanced' | 'full';
  badgeType: 'none' | 'pro' | 'premium';
  commissionDiscount: number;  // e.g. 0.01 = 1% commission discount for premium
  startDate: string;
  renewalDate: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
}

export interface SubscriptionTierConfig {
  tier: SubscriptionTier;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  maxActiveListings: number;
  featuredListings: number;
  prioritySupport: boolean;
  analyticsAccess: 'basic' | 'advanced' | 'full';
  badgeType: 'none' | 'pro' | 'premium';
  commissionDiscount: number;
  features: string[];
  gradient: string;
  icon: string;
  isPopular?: boolean;
}

export const SUBSCRIPTION_TIERS: SubscriptionTierConfig[] = [
  {
    tier: 'free',
    name: 'Starter',
    tagline: 'Get discovered by customers',
    priceMonthly: 0,
    priceYearly: 0,
    maxActiveListings: 3,
    featuredListings: 0,
    prioritySupport: false,
    analyticsAccess: 'basic',
    badgeType: 'none',
    commissionDiscount: 0,
    features: [
      'Up to 3 active listings',
      'Basic analytics dashboard',
      'Standard support (48h response)',
      'Customer messaging',
      'Calendar management',
      'Standard search visibility',
    ],
    gradient: 'linear-gradient(135deg, #64748b, #94a3b8)',
    icon: 'bi-rocket-takeoff',
  },
  {
    tier: 'pro',
    name: 'Professional',
    tagline: 'Grow your event business',
    priceMonthly: 999,
    priceYearly: 9990,
    maxActiveListings: 999,
    featuredListings: 0,
    prioritySupport: false,
    analyticsAccess: 'advanced',
    badgeType: 'pro',
    commissionDiscount: 0,
    isPopular: true,
    features: [
      'Unlimited active listings',
      'Advanced analytics + trends',
      'Priority support (12h response)',
      '"Pro Vendor" badge on profile',
      'Quote Board access (RFP bids)',
      'Promotional offers & coupons',
      'Staff management tools',
      'B2B vendor network access',
    ],
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    icon: 'bi-award',
  },
  {
    tier: 'premium',
    name: 'Premium',
    tagline: 'Dominate your market',
    priceMonthly: 2999,
    priceYearly: 29990,
    maxActiveListings: 999,
    featuredListings: 3,
    prioritySupport: true,
    analyticsAccess: 'full',
    badgeType: 'premium',
    commissionDiscount: 0.02,  // 2% lower commission rate
    features: [
      'Everything in Professional',
      '3 featured/promoted listings',
      'Dedicated account manager',
      '"Premium Partner" badge',
      '2% lower commission rate',
      'Full revenue analytics',
      'Priority search ranking',
      'Exclusive seasonal campaigns',
      'Custom branding options',
    ],
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    icon: 'bi-gem',
  },
];
