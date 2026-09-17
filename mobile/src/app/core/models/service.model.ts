export type ServiceCategory = 'venue' | 'catering' | 'decoration' | 'transport' | 'priest' | 'manpower' | 'photography' | 'music' | 'beauty' | 'travel' | 'shopping' | 'custom';

export interface ServiceCategoryDef {
  id: ServiceCategory | string;
  name: string;
  icon: string;
  description: string;
  isDynamic?: boolean;
}

export interface VendorService {
  id: string;
  vendorId: string;
  vendorName: string;
  category: string;
  name: string;
  description: string;
  pricePerUnit: number;
  unit: string;
  minGuests?: number;
  maxGuests?: number;
  city: string;
  images: string[];
  rating: number;
  totalReviews: number;
  isActive: boolean;
  isVerified: boolean;
  activeImageIndex?: number;
  verificationStatus?: string;
  verificationComment?: string | null;
}
