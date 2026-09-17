export type UserRole = 'customer' | 'vendor' | 'admin' | 'support';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  token?: string;
}

export interface CustomerProfile extends AuthUser {
  role: 'customer';
  city: string;
  totalBookings: number;
  loyaltyPoints: number;
  loyaltyTier?: 'Bronze' | 'Silver' | 'Gold';
  totalSpent?: number;
  joinedDate?: string;
  strikes?: number;
  accountStatus?: 'active' | 'warning' | 'restricted' | 'suspended' | 'banned';
  suspensionReason?: string;
  suspensionDuration?: string;
}

export interface LoyaltyTransaction {
  id: string;
  date: string;
  description: string;
  points: number;
  type: 'earned' | 'redeemed';
}

export interface VendorProfile extends AuthUser {
  role: 'vendor';
  businessName: string;
  city: string;
  verificationStatus: 'pending' | 'under_review' | 'verified' | 'rejected';
  rating: number;
  totalReviews: number;
  services: string[];
}
