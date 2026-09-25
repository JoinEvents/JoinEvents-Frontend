/** An admin-defined category key (e.g. "wedding") — categories come from the catalogue, not a fixed list. */
export type EventCategory = string;

export interface EventType {
  /** The category key — what packages are filed under and search filters by. */
  id: string;
  /** The server's record id — what tiers reference as their categoryId. */
  uuid?: string;
  name: string;
  nameHindi?: string;
  description?: string;
  /** Bootstrap Icons class from the catalogue (e.g. "bi-hearts"); empty when none is set. */
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
  vendorId?: string;
  vendorName?: string;
  vendorDescription?: string;
  name: string;
  /** Name of the admin-defined pricing tier (stored by the API as the package's theme). */
  tier: string;
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
    cuisine?: string;
    cuisineType?: string;
  };
  amenities?: {
    hasAc?: boolean;
    hasPowerBackup?: boolean;
    hasChangingRooms?: boolean;
    hasParking?: boolean;
  };
  /** What the vendor entered for each service in the package, keyed by service name. */
  serviceDetails?: Record<string, PackageServiceDetail>;
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


/** One service of a package as the vendor described it. Prices are before GST. */
export interface PackageServiceDetail {
  description: string;
  minPrice: number;
  maxPrice: number;
  images: string[];
  keyFeatures: string[];
  inclusions: string[];
}
