import { Tier } from '../models/catalogue.model';

/**
 * "Wedding Photography" → "wedding_photography". Same rule as the web app's
 * AdminCategoryService.toSlug, and it produces what the API's categoryKey
 * validation accepts (a-z, 0-9, _).
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_');
}

export interface GradientParts {
  direction: string;
  color1: string;
  color2: string;
}

/** Splits a two-stop `linear-gradient(dir,#a,#b)` into its parts, or null for anything else. */
export function parseGradient(gradient: string | null | undefined): GradientParts | null {
  const m = (gradient ?? '').match(/linear-gradient\(\s*([^,#]+),\s*(#[\da-fA-F]{3,8})\s*,\s*(#[\da-fA-F]{3,8})\s*\)/);
  return m ? { direction: m[1].trim(), color1: m[2], color2: m[3] } : null;
}

export function buildGradient(parts: GradientParts): string {
  return `linear-gradient(${parts.direction},${parts.color1},${parts.color2})`;
}

/**
 * Distinct non-empty values, most frequent first. Used to offer the gradients
 * and icons already in the catalogue as one-tap suggestions — the options come
 * from the data rather than from a list baked into the app.
 */
export function distinctByUse(values: (string | null | undefined)[]): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw?.trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
}

/** The cheapest a tier can be: the sum of its services' minimum prices. */
export function tierFloor(tier: Pick<Tier, 'priceRanges'>): number {
  return (tier.priceRanges ?? []).reduce((sum, r) => sum + (Number(r.minPrice) || 0), 0);
}

/**
 * Orders tiers by category, then from cheapest to most expensive. Derived from
 * each tier's own price ranges, so a new tier sorts correctly without the app
 * knowing tier names in advance.
 */
export function compareTiers(a: Tier, b: Tier): number {
  return (a.categoryName ?? '').localeCompare(b.categoryName ?? '')
    || tierFloor(a) - tierFloor(b)
    || a.name.localeCompare(b.name);
}
