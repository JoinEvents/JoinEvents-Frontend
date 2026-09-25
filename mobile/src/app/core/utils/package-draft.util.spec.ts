import {
  INCLUSION_MARKER, draftFromPackage, draftToPayload, emptyDraft, inclusionKind, joinDescription,
  splitDescription, syncDerivedPrices, validateBasics, validateDayPlan, validateServices, withIncludes,
  PackageDraft
} from './package-draft.util';
import { profileGaps } from './vendor-readiness.util';
import { Tier } from '../models/catalogue.model';

const gold: Tier = {
  id: 't1', name: 'Gold', categoryId: 'c1', isActive: true,
  priceRanges: [
    { serviceName: 'Catering', minPrice: 400, maxPrice: 900 },
    { serviceName: 'Photography', minPrice: 20000, maxPrice: 60000 }
  ]
};

function completeDraft(): PackageDraft {
  let d = emptyDraft();
  d = {
    ...d, name: 'Royal Hall', category: 'wedding', experience: 5, description: 'Grand weddings',
    address: { country: 'India', state: 'Telangana', city: 'Hyderabad', locality: 'Madhapur', street: 'Main Rd', landmark: '', pincode: '500081' },
    tier: 'Gold', cuisine: 'South Indian', cuisineType: 'veg', vegPrice: 650
  };
  d = withIncludes(d, ['Catering', 'Photography']);
  for (const name of d.includes) {
    d.details[name] = { ...d.details[name], description: `${name} details`, images: ['https://x/a.jpg'], keyFeatures: ['Great'] };
  }
  d.details['Photography'].minPrice = 30000;
  d.dayPlan = [{ title: 'Day 1', details: 'Setup and ceremony', seatingCapacity: 0, floatingCapacity: 0 }];
  return syncDerivedPrices(d);
}

describe('package draft', () => {
  it('classifies services the way the API prices them', () => {
    expect(inclusionKind('Catering')).toBe('catering');
    expect(inclusionKind('Premium Catering Service')).toBe('catering');
    expect(inclusionKind(' Venue ')).toBe('venue');
    expect(inclusionKind('Venue Decoration')).toBe('service');
    expect(inclusionKind('Photography')).toBe('service');
  });

  it('splits and joins the inclusion-details description block', () => {
    const joined = joinDescription('Hello', { A: { description: 'a', minPrice: 1, maxPrice: 1, images: [], keyFeatures: [], inclusions: [] } });
    expect(joined).toContain(`Hello\n\n${INCLUSION_MARKER}\n{`);
    const split = splitDescription(joined);
    expect(split.text).toBe('Hello');
    expect(split.details['A'].description).toBe('a');
    expect(splitDescription('plain text')).toEqual({ text: 'plain text', details: {} });
    expect(splitDescription(`keep me\n${INCLUSION_MARKER}\n{broken`).text).toBe('keep me');
    expect(joinDescription('No services', {})).toBe('No services');
  });

  it('mirrors catering and venue prices into their service rows', () => {
    let d = withIncludes({ ...emptyDraft(), vegPrice: 500, nonVegPrice: 800, cuisineType: 'mixed', rent: 90000 }, ['Catering', 'Venue']);
    expect(d.details['Catering']).toEqual(jasmine.objectContaining({ minPrice: 500, maxPrice: 800 }));
    expect(d.details['Venue']).toEqual(jasmine.objectContaining({ minPrice: 90000, maxPrice: 90000 }));
    d = syncDerivedPrices({ ...d, cuisineType: 'nonveg' });
    expect(d.details['Catering'].minPrice).toBe(800);
  });

  it('keeps details for services that stay selected and drops removed ones', () => {
    let d = withIncludes(emptyDraft(), ['Photography', 'DJ']);
    d.details['Photography'].description = 'kept';
    d = withIncludes(d, ['Photography']);
    expect(Object.keys(d.details)).toEqual(['Photography']);
    expect(d.details['Photography'].description).toBe('kept');
  });

  it('validates each step with the web rules plus the tier range', () => {
    const d = completeDraft();
    expect(validateBasics(d)).toBeNull();
    expect(validateServices(d, gold, true)).toBeNull();
    expect(validateDayPlan(d)).toBeNull();

    expect(validateBasics({ ...d, address: { ...d.address, pincode: '' } })?.message).toContain('pincode');
    expect(validateBasics({ ...d, experience: -1 })?.step).toBe(1);
    expect(validateServices({ ...d, tier: '' }, null, true)?.message).toContain('tier');
    expect(validateServices({ ...d, tier: '' }, null, false)).toBeNull();

    const tooCheap = syncDerivedPrices({ ...d, vegPrice: 100 });
    expect(validateServices(tooCheap, gold, true)).toEqual(jasmine.objectContaining({ service: 'Catering' }));
    const pricey = { ...d, details: { ...d.details, Photography: { ...d.details['Photography'], minPrice: 90000 } } };
    expect(validateServices(syncDerivedPrices(pricey), gold, true)?.message).toContain('at most');

    const noPhoto = { ...d, details: { ...d.details, Photography: { ...d.details['Photography'], images: [] } } };
    expect(validateServices(noPhoto, gold, true)?.message).toContain('photo');
    expect(validateDayPlan({ ...d, dayPlan: [] })?.step).toBe(3);
  });

  it('builds the same payload as the web console and reads it back', () => {
    const d = completeDraft();
    d.photos = ['https://x/p1.jpg'];
    const payload = draftToPayload(d) as Record<string, any>;
    expect(payload['theme']).toBe('Gold');
    expect(payload['pricing']).toEqual(jasmine.objectContaining({ vegPrice: 650, nonVegPrice: 0, cuisine: 'South Indian', cuisineType: 'veg' }));
    expect(payload['spaces']).toEqual([{ name: 'Day 1', type: 'Setup and ceremony', seatingCapacity: 0, floatingCapacity: 0 }]);
    expect(payload['includes']).toEqual(['Catering', 'Photography']);
    expect(payload['images']).toEqual(['https://x/p1.jpg']);
    expect(payload['description']).toContain(INCLUSION_MARKER);

    // What GET returns for it (after the camelCase interceptor)
    const back = draftFromPackage({ ...payload, capacity: payload['capacity'], address: payload['address'] });
    expect(back.name).toBe('Royal Hall');
    expect(back.description).toBe('Grand weddings');
    expect(back.details['Photography'].minPrice).toBe(30000);
    expect(back.details['Catering'].minPrice).toBe(650);
    expect(back.tier).toBe('Gold');
    expect(back.dayPlan[0].title).toBe('Day 1');
  });
});

describe('vendor readiness', () => {
  it('treats the API placeholder business name as missing', () => {
    expect(profileGaps({ businessName: 'My Vendor Business', description: 'x' })).toEqual(['Business name']);
    expect(profileGaps({ businessName: 'Royal', description: ' ' })).toEqual(['Business description']);
    expect(profileGaps({ businessName: 'Royal', description: 'We cater' })).toEqual([]);
    expect(profileGaps(null)).toEqual(['Business name', 'Business description']);
  });
});
