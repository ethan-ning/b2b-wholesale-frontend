import { describe, expect, it } from 'vitest';
import { standardPriceOf } from './tierPricing';

/**
 * The same cases as DiscountPercentTest and PricingPolicyTest on the backend. They are
 * duplicated deliberately: this arithmetic exists twice, and these are what catch the two
 * copies drifting apart.
 */
describe('tierPricing, against the backend’s own cases', () => {
  it('takes a percentage off a price', () => {
    expect(standardPriceOf(100, 18)).toBe(82);
    expect(standardPriceOf(100, 7)).toBe(93);
    expect(standardPriceOf(18, 18)).toBe(14.76);
    expect(standardPriceOf(18, 7)).toBe(16.74);
  });

  it('rounds to the cent, half up', () => {
    // 9.99 less 7% is 9.2907
    expect(standardPriceOf(9.99, 7)).toBe(9.29);
    // 0.15 less 50% is 0.075, which JavaScript's toFixed would send down to 0.07
    expect(standardPriceOf(0.15, 50)).toBe(0.08);
  });

  it('keeps a fractional discount to the cent', () => {
    expect(standardPriceOf(100, 12.345)).toBe(87.65);
  });

  it('a tier taking nothing off pays list', () => {
    expect(standardPriceOf(19, 0)).toBe(19);
  });

  it('nothing off nothing is still nothing', () => {
    expect(standardPriceOf(0, 18)).toBe(0);
  });
});
