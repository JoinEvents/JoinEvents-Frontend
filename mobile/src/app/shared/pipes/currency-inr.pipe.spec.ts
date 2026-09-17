import { CurrencyInrPipe } from './currency-inr.pipe';

describe('CurrencyInrPipe', () => {
  const pipe = new CurrencyInrPipe();

  it('groups by the Indian lakh/crore convention', () => {
    expect(pipe.transform(1_250_000)).toBe('₹12,50,000');
  });

  it('treats null and undefined as zero rather than rendering NaN', () => {
    expect(pipe.transform(null)).toBe('₹0');
    expect(pipe.transform(undefined)).toBe('₹0');
  });

  it('abbreviates to K, L and Cr in compact mode', () => {
    expect(pipe.transform(5_000, true)).toBe('₹5K');
    expect(pipe.transform(250_000, true)).toBe('₹2.5L');
    expect(pipe.transform(30_000_000, true)).toBe('₹3Cr');
  });

  it('keeps small amounts unabbreviated in compact mode', () => {
    expect(pipe.transform(850, true)).toBe('₹850');
  });
});
