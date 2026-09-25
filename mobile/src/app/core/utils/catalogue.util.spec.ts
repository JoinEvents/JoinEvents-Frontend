import { buildGradient, compareTiers, distinctByUse, parseGradient, tierFloor, toSlug } from './catalogue.util';
import { Tier } from '../models/catalogue.model';

describe('catalogue utils', () => {
  it('toSlug matches the API key rule', () => {
    expect(toSlug('  Wedding Photography ')).toBe('wedding_photography');
    expect(toSlug('Birthday & Kids Party!')).toBe('birthday_kids_party');
  });

  it('parses and rebuilds a two-stop gradient', () => {
    const parts = parseGradient('linear-gradient(135deg, #E91E8C, #FF6B6B)');
    expect(parts).toEqual({ direction: '135deg', color1: '#E91E8C', color2: '#FF6B6B' });
    expect(buildGradient(parts!)).toBe('linear-gradient(135deg,#E91E8C,#FF6B6B)');
    expect(parseGradient('linear-gradient(#a,#b,#c)')).toBeNull();
    expect(parseGradient(null)).toBeNull();
  });

  it('distinctByUse orders by frequency and drops blanks', () => {
    expect(distinctByUse(['bi-gem', 'bi-star', 'bi-gem', '', null, ' bi-star ', 'bi-gem']))
      .toEqual(['bi-gem', 'bi-star']);
  });

  it('sorts tiers by category, then by price floor — not by name', () => {
    const tier = (name: string, categoryName: string, mins: number[]): Tier => ({
      id: name, name, categoryId: categoryName, categoryName, isActive: true,
      priceRanges: mins.map((minPrice, i) => ({ serviceName: `s${i}`, minPrice, maxPrice: minPrice * 2 }))
    });
    const platinum = tier('Platinum', 'Wedding', [50000, 20000]);
    const silver = tier('Silver', 'Wedding', [10000]);
    const gold = tier('Gold', 'Wedding', [15000, 10000]);
    const other = tier('Basic', 'Birthday', [100000]);
    expect(tierFloor(gold)).toBe(25000);
    expect([platinum, silver, other, gold].sort(compareTiers).map(t => t.name))
      .toEqual(['Basic', 'Silver', 'Gold', 'Platinum']);
  });
});
