export interface Vendor {
  id: string;
  name: string;
  avatar?: string;
  businessName: string;
  email: string;
  phone: string;
  city: string;
  state?: string;
  services: string[];
  serviceCategory?: string; // For B2B Network filtering
  sustainabilityTags?: string[];
  isVerified?: boolean;
  verificationStatus: 'pending' | 'under_review' | 'verified' | 'rejected' | 'action_required';
  verificationDocs: VerificationDoc[];
  rating: number;
  totalReviews: number;
  totalEarnings: number;
  joinedDate: string;
  bankAccount?: string;
  gstNumber?: string;
  // --- Subscription Fields (managed by backend) ---
  subscriptionTier?: 'free' | 'pro' | 'premium';
  subscriptionBadge?: string;
  subscriptionExpiry?: string;
  notes?: string;
  accountStatus?: 'active' | 'suspended' | 'banned';
  suspensionReason?: string;
  suspensionDuration?: string;
}

export interface VerificationDoc {
  type: string;
  name: string;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'action_required';
  fileUrl?: string;
  url?: string;
}

export interface CalendarDay {
  date: string;
  status: 'available' | 'booked' | 'blocked' | 'unavailable';
  bookingId?: string;
  eventName?: string;
  customerName?: string;
  totalAmount?: number;
  packageName?: string;
}
