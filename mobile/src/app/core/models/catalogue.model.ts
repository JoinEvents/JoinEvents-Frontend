/**
 * Catalogue records as the admin API returns them. Mirrors the web app's
 * AdminCategoryService / AdminTierService models so both clients agree on
 * every field.
 */
export interface EventCategory {
  id: string;
  name: string;
  nameHindi?: string | null;
  /** URL-safe key derived from the name, e.g. "wedding_photography". */
  categoryKey: string;
  /** Bootstrap Icons class, e.g. "bi-hearts" — shared with the web app. */
  icon: string;
  gradient?: string | null;
  colorClass?: string | null;
  startingPrice?: number | null;
  description?: string | null;
  popularServices?: string[] | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryPayload {
  name: string;
  nameHindi?: string;
  categoryKey: string;
  icon: string;
  gradient?: string;
  colorClass?: string;
  startingPrice?: number;
  description?: string;
  popularServices?: string[];
  isActive?: boolean;
}

export interface TierPriceRange {
  serviceName: string;
  minPrice: number;
  maxPrice: number;
}

export interface Tier {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  categoryGradient?: string;
  description?: string | null;
  isActive: boolean;
  icon?: string | null;
  gradient?: string | null;
  priceRanges: TierPriceRange[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TierPayload {
  name: string;
  categoryId: string;
  description?: string;
  isActive?: boolean;
  icon?: string;
  gradient?: string;
  priceRanges: TierPriceRange[];
}

/** A saved record, or the server's message explaining why it was not saved. */
export interface CatalogueResult<T> {
  data?: T;
  error?: string;
}
