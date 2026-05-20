export type EventCategory = 'wedding' | 'birthday' | 'corporate' | 'religious' | 'social' | 'custom' | 'beauty' | 'travel' | 'shopping';

export interface EventType {
  id: string;
  name: string;
  nameHindi?: string;
  description?: string;
  icon: string;
  category: EventCategory;
  colorClass?: string;
  gradient?: string;
  startingPrice?: number;
  popularServices?: string[];
}

export interface EventPackage {
  id: string;
  eventTypeId: string;
  name: string;
  tier: 'basic' | 'standard' | 'premium';
  price: number;
  description: string;
  services: string[];
  maxGuests: number;
  durationHours: number;
  isPopular?: boolean;
  offerExpiresIn?: string;
  insurancePrice?: number;
  image?: string;
  images?: string[];
  addons?: { id: string, name: string, price: number }[];
  sustainabilityTags?: string[];
  experience?: number;
  rating?: number;
  totalReviews?: number;
  address?: {
    country?: string;
    state?: string;
    city?: string;
    locality?: string;
    street?: string;
    landmark?: string;
    pincode?: string;
  };
  pricing?: {
    vegPrice?: number;
    nonVegPrice?: number;
    roomPrice?: number;
    basePrice?: number;
    rent?: number;
    unit?: string;
  };
  capacity?: {
    maxGuests?: number;
    parkingCapacity?: number;
    totalRooms?: number;
  };
  policies?: {
    cateringPolicy?: string;
    decorPolicy?: string;
    alcoholPolicy?: string;
    djPolicy?: string;
  };
  spaces?: {
    name?: string;
    type?: string;
    seatingCapacity?: number;
    floatingCapacity?: number;
  }[];
}

