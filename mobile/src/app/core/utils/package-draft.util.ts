import { Tier, TierPriceRange } from '../models/catalogue.model';

/**
 * The vendor package form's data, and its round trip to the API.
 *
 * The contract is the web console's (vendor/add-service): per-service details
 * travel inside the description after a marker, as JSON — the API reads that
 * JSON back to compute the package's base price, and the customer package
 * page renders it. Keeping the same shape means packages created in the app
 * and on the web are interchangeable.
 */

export const INCLUSION_MARKER = '---INCLUSION_DETAILS---';
export const MAX_SERVICE_PHOTOS = 5;
export const MAX_PORTFOLIO_PHOTOS = 5;

export type CuisineType = 'veg' | 'nonveg' | 'mixed';

export interface InclusionDetail {
  description: string;
  minPrice: number;
  maxPrice: number;
  images: string[];
  keyFeatures: string[];
  inclusions: string[];
}

export interface DayPlan {
  title: string;
  details: string;
  /** Carried through untouched: the API's space fields the day plan reuses. */
  seatingCapacity: number;
  floatingCapacity: number;
}

export interface PackageAddress {
  country: string;
  state: string;
  city: string;
  locality: string;
  street: string;
  landmark: string;
  pincode: string;
}

export interface PackageDraft {
  name: string;
  /** Category key (what packages are filed under). */
  category: string;
  experience: number | null;
  description: string;
  address: PackageAddress;
  /** Admin-defined tier name; the API stores it as the package's theme. */
  tier: string;
  includes: string[];
  details: Record<string, InclusionDetail>;
  cuisine: string;
  cuisineType: CuisineType;
  vegPrice: number;
  nonVegPrice: number;
  rent: number;
  totalRooms: number;
  roomPrice: number;
  maxGuests: number;
  parkingCapacity: number;
  cateringPolicy: string;
  decorPolicy: string;
  alcoholPolicy: string;
  djPolicy: string;
  hasAc: boolean;
  hasPowerBackup: boolean;
  hasChangingRooms: boolean;
  hasParking: boolean;
  /** Preserved from an existing package; not edited by the form. */
  unit: string;
  basePrice: number;
  dayPlan: DayPlan[];
  photos: string[];
}

export function emptyDraft(): PackageDraft {
  return {
    name: '', category: '', experience: null, description: '',
    address: { country: '', state: '', city: '', locality: '', street: '', landmark: '', pincode: '' },
    tier: '', includes: [], details: {},
    cuisine: '', cuisineType: 'veg', vegPrice: 0, nonVegPrice: 0,
    rent: 0, totalRooms: 0, roomPrice: 0, maxGuests: 0, parkingCapacity: 0,
    cateringPolicy: '', decorPolicy: '', alcoholPolicy: '', djPolicy: '',
    hasAc: false, hasPowerBackup: false, hasChangingRooms: false, hasParking: false,
    unit: '', basePrice: 0,
    dayPlan: [emptyDay()],
    photos: []
  };
}

export function emptyDay(): DayPlan {
  return { title: '', details: '', seatingCapacity: 0, floatingCapacity: 0 };
}

export function emptyDetail(price = 0): InclusionDetail {
  return { description: '', minPrice: price, maxPrice: price, images: [], keyFeatures: [], inclusions: [] };
}

// ---- pricing rules ---------------------------------------------------------

export type InclusionKind = 'catering' | 'venue' | 'service';

/**
 * How a service is priced. Catering is per plate (the API multiplies a
 * catering price under ₹5,000 by the guest count, matching any service whose
 * name contains "catering"); a venue is priced by its rent and carries the
 * capacity, rooms, policies and amenities; everything else has one price.
 */
export function inclusionKind(name: string): InclusionKind {
  const n = name.trim().toLowerCase();
  if (n.includes('catering')) return 'catering';
  if (n === 'venue') return 'venue';
  return 'service';
}

/** The price range the chosen tier allows for a service, matched by name. */
export function tierLimit(tier: Tier | null | undefined, service: string): TierPriceRange | null {
  const key = service.trim().toLowerCase();
  return tier?.priceRanges?.find(r => r.serviceName.trim().toLowerCase() === key) ?? null;
}

/**
 * Catering and venue prices are entered as plate prices and rent; their
 * service rows mirror them (as the web form does), so the API's price
 * calculation and the tier check see the same numbers.
 */
export function syncDerivedPrices(draft: PackageDraft): PackageDraft {
  const details = { ...draft.details };
  for (const name of draft.includes) {
    const detail = details[name];
    if (!detail) continue;
    const kind = inclusionKind(name);
    if (kind === 'catering') {
      const veg = draft.vegPrice || 0;
      const nonVeg = draft.nonVegPrice || 0;
      const [min, max] = draft.cuisineType === 'veg' ? [veg, veg]
        : draft.cuisineType === 'nonveg' ? [nonVeg, nonVeg]
        : [Math.min(veg, nonVeg), Math.max(veg, nonVeg)];
      details[name] = { ...detail, minPrice: min, maxPrice: max };
    } else if (kind === 'venue') {
      details[name] = { ...detail, minPrice: draft.rent || 0, maxPrice: draft.rent || 0 };
    } else {
      details[name] = { ...detail, maxPrice: detail.minPrice };
    }
  }
  return { ...draft, details };
}

/** Keeps details in step with the selected services: new ones get a blank entry, removed ones are dropped. */
export function withIncludes(draft: PackageDraft, includes: string[]): PackageDraft {
  const details: Record<string, InclusionDetail> = {};
  for (const name of includes) details[name] = draft.details[name] ?? emptyDetail();
  return syncDerivedPrices({ ...draft, includes, details });
}

// ---- validation -------------------------------------------------------------

export interface DraftProblem {
  step: number;
  message: string;
  /** The service the problem is in, so the form can open it. */
  service?: string;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function validateBasics(d: PackageDraft): DraftProblem | null {
  const fail = (message: string): DraftProblem => ({ step: 1, message });
  if (!d.name.trim()) return fail('Enter the business / venue name.');
  if (!d.category) return fail('Choose an event category.');
  if (d.experience !== null && (!Number.isInteger(d.experience) || d.experience < 0)) {
    return fail('Experience must be a whole number of years.');
  }
  if (!d.description.trim()) return fail('Describe your service.');
  const a = d.address;
  const required: [keyof PackageAddress, string][] = [
    ['country', 'country'], ['state', 'state'], ['city', 'city'],
    ['locality', 'locality'], ['street', 'street / area'], ['pincode', 'pincode']
  ];
  for (const [field, label] of required) {
    if (!a[field].trim()) return fail(`Enter the ${label}.`);
  }
  if (!/^[A-Za-z0-9 -]{3,10}$/.test(a.pincode.trim())) return fail('Enter a valid pincode.');
  return null;
}

export function validateServices(d: PackageDraft, tier: Tier | null, tiersAvailable: boolean): DraftProblem | null {
  const fail = (message: string, service?: string): DraftProblem => ({ step: 2, message, service });
  if (tiersAvailable && !d.tier) return fail('Choose a service tier.');
  if (!d.includes.length) return fail('Select at least one service.');

  for (const name of d.includes) {
    const detail = d.details[name];
    if (!detail) return fail(`Add the details for ${name}.`, name);
    if (!detail.description.trim()) return fail(`Describe what ${name} includes.`, name);

    const kind = inclusionKind(name);
    if (kind === 'catering') {
      if (!d.cuisine.trim()) return fail('Enter the cuisine.', name);
      if (d.cuisineType !== 'nonveg' && !(d.vegPrice > 0)) return fail('Enter a veg price per plate above ₹0.', name);
      if (d.cuisineType !== 'veg' && !(d.nonVegPrice > 0)) return fail('Enter a non-veg price per plate above ₹0.', name);
    } else if (kind === 'venue') {
      if (!(d.rent > 0)) return fail('Enter the venue rent above ₹0.', name);
      if (!(d.maxGuests > 0)) return fail('Enter the venue\'s maximum guest capacity.', name);
    } else if (!(detail.minPrice > 0)) {
      return fail(`Enter a price for ${name} above ₹0.`, name);
    }

    const limit = tierLimit(tier, name);
    if (limit) {
      if (detail.minPrice < limit.minPrice) return fail(`${name}: the ${d.tier} tier needs at least ${inr(limit.minPrice)}.`, name);
      if (limit.maxPrice > 0 && detail.maxPrice > limit.maxPrice) {
        return fail(`${name}: the ${d.tier} tier allows at most ${inr(limit.maxPrice)}.`, name);
      }
    }

    if (!detail.images.length) return fail(`Add at least one photo for ${name}.`, name);
    if (!detail.keyFeatures.length) return fail(`Add at least one key feature for ${name}.`, name);
  }
  return null;
}

export function validateDayPlan(d: PackageDraft): DraftProblem | null {
  if (!d.dayPlan.length) return { step: 3, message: 'Add at least one day to your plan.' };
  for (let i = 0; i < d.dayPlan.length; i++) {
    if (!d.dayPlan[i].title.trim()) return { step: 3, message: `Give day ${i + 1} a title.` };
    if (!d.dayPlan[i].details.trim()) return { step: 3, message: `Describe what happens on day ${i + 1}.` };
  }
  return null;
}

export function validateDraft(d: PackageDraft, tier: Tier | null, tiersAvailable: boolean): DraftProblem | null {
  return validateBasics(d) ?? validateServices(d, tier, tiersAvailable) ?? validateDayPlan(d);
}

// ---- API round trip ---------------------------------------------------------

export function splitDescription(raw: string | null | undefined): { text: string; details: Record<string, Partial<InclusionDetail>> } {
  const value = raw ?? '';
  const at = value.indexOf(INCLUSION_MARKER);
  if (at < 0) return { text: value.trim(), details: {} };
  let details: Record<string, Partial<InclusionDetail>> = {};
  try {
    const parsed = JSON.parse(value.slice(at + INCLUSION_MARKER.length).trim());
    if (parsed && typeof parsed === 'object') details = parsed;
  } catch {
    // A malformed block loses the per-service details, not the description.
  }
  return { text: value.slice(0, at).trim(), details };
}

export function joinDescription(text: string, details: Record<string, InclusionDetail>): string {
  return Object.keys(details).length
    ? `${text.trim()}\n\n${INCLUSION_MARKER}\n${JSON.stringify(details)}`
    : text.trim();
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v)) || 0;
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

/** Rebuilds the form from a package as GET /vendor/packages/:id returns it (camel-cased). */
export function draftFromPackage(pkg: Record<string, unknown>): PackageDraft {
  const d = emptyDraft();
  const address = (pkg['address'] ?? {}) as Record<string, unknown>;
  const pricing = (pkg['pricing'] ?? {}) as Record<string, unknown>;
  const capacity = (pkg['capacity'] ?? {}) as Record<string, unknown>;
  const policies = (pkg['policies'] ?? {}) as Record<string, unknown>;
  const amenities = (pkg['amenities'] ?? {}) as Record<string, unknown>;
  const { text, details } = splitDescription(str(pkg['description']));

  d.name = str(pkg['name']);
  d.category = str(pkg['category']);
  const exp = pkg['experience'];
  d.experience = exp === null || exp === undefined || exp === '' ? null : num(exp);
  d.description = text;
  for (const key of Object.keys(d.address) as (keyof PackageAddress)[]) d.address[key] = str(address[key]);
  d.tier = str(pkg['theme']);

  d.cuisine = str(pricing['cuisine']);
  const cuisineType = str(pricing['cuisineType']);
  d.cuisineType = cuisineType === 'nonveg' || cuisineType === 'mixed' ? cuisineType : 'veg';
  d.vegPrice = num(pricing['vegPrice']);
  d.nonVegPrice = num(pricing['nonVegPrice']);
  d.rent = num(pricing['rent']);
  d.roomPrice = num(pricing['roomPrice']);
  d.basePrice = num(pricing['basePrice']);
  d.unit = str(pricing['unit']);
  d.maxGuests = num(capacity['maxGuests']);
  d.parkingCapacity = num(capacity['parkingCapacity']);
  d.totalRooms = num(capacity['totalRooms']);
  d.cateringPolicy = str(policies['cateringPolicy']);
  d.decorPolicy = str(policies['decorPolicy']);
  d.alcoholPolicy = str(policies['alcoholPolicy']);
  d.djPolicy = str(policies['djPolicy']);
  d.hasAc = amenities['hasAc'] === true;
  d.hasPowerBackup = amenities['hasPowerBackup'] === true;
  d.hasChangingRooms = amenities['hasChangingRooms'] === true;
  d.hasParking = amenities['hasParking'] === true;

  const spaces = Array.isArray(pkg['spaces']) ? pkg['spaces'] as Record<string, unknown>[] : [];
  d.dayPlan = spaces.length
    ? spaces.map(s => ({
        title: str(s['name']), details: str(s['type']),
        seatingCapacity: num(s['seatingCapacity']), floatingCapacity: num(s['floatingCapacity'])
      }))
    : [emptyDay()];

  d.photos = strings(pkg['images']);
  d.includes = strings(pkg['includes']);
  for (const name of d.includes) {
    const saved = details[name] ?? {};
    d.details[name] = {
      description: str(saved.description),
      minPrice: num(saved.minPrice),
      maxPrice: num(saved.maxPrice ?? saved.minPrice),
      images: strings(saved.images),
      keyFeatures: strings(saved.keyFeatures),
      inclusions: strings(saved.inclusions)
    };
  }
  return syncDerivedPrices(d);
}

/** The create/update body, field for field what the web console sends. */
export function draftToPayload(input: PackageDraft): Record<string, unknown> {
  const d = syncDerivedPrices(input);
  const details: Record<string, InclusionDetail> = {};
  for (const name of d.includes) if (d.details[name]) details[name] = d.details[name];

  return {
    category: d.category,
    name: d.name.trim(),
    description: joinDescription(d.description, details),
    theme: d.tier,
    experience: d.experience ?? 0,
    address: Object.fromEntries(Object.entries(d.address).map(([k, v]) => [k, v.trim()])),
    pricing: {
      vegPrice: d.cuisineType === 'nonveg' ? 0 : d.vegPrice,
      nonVegPrice: d.cuisineType === 'veg' ? 0 : d.nonVegPrice,
      roomPrice: d.roomPrice,
      basePrice: d.basePrice,
      rent: d.rent,
      unit: d.unit,
      cuisine: d.cuisine.trim(),
      cuisineType: d.cuisineType
    },
    capacity: { maxGuests: d.maxGuests, parkingCapacity: d.parkingCapacity, totalRooms: d.totalRooms },
    policies: {
      cateringPolicy: d.cateringPolicy.trim(),
      decorPolicy: d.decorPolicy.trim(),
      alcoholPolicy: d.alcoholPolicy.trim(),
      djPolicy: d.djPolicy.trim()
    },
    amenities: {
      hasAc: d.hasAc, hasPowerBackup: d.hasPowerBackup,
      hasChangingRooms: d.hasChangingRooms, hasParking: d.hasParking
    },
    spaces: d.dayPlan.map(day => ({
      name: day.title.trim(), type: day.details.trim(),
      seatingCapacity: day.seatingCapacity, floatingCapacity: day.floatingCapacity
    })),
    includes: d.includes,
    images: d.photos
  };
}
