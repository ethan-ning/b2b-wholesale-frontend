import { describe, expect, it } from 'vitest';
import { listPriceOf, standardPriceOf } from './tierPricing';

/**
 * The same cases as DiscountPercentTest and PricingPolicyTest on the backend. They are
 * duplicated deliberately: this arithmetic exists twice, and these are what catch the two
 * copies drifting apart.
 */
describe('tierPricing, against the backend’s own cases', () => {
  it('takes a percentage off a price', () => {
    expect(standardPriceOf(100, 1, 18)).toBe(82);
    expect(standardPriceOf(100, 1, 7)).toBe(93);
    expect(standardPriceOf(18, 1, 18)).toBe(14.76);
    expect(standardPriceOf(18, 1, 7)).toBe(16.74);
  });

  it('rounds to the cent, half up', () => {
    // 9.99 less 7% is 9.2907
    expect(standardPriceOf(9.99, 1, 7)).toBe(9.29);
    // 0.15 less 50% is 0.075, which JavaScript's toFixed would send down to 0.07
    expect(standardPriceOf(0.15, 1, 50)).toBe(0.08);
  });

  it('keeps a fractional discount to the cent', () => {
    expect(standardPriceOf(100, 1, 12.345)).toBe(87.65);
  });

  it('discounts a pack as a pack, not a unit at a time', () => {
    // 114.00 less 18%
    expect(standardPriceOf(19, 6, 18)).toBe(93.48);
    // 119.88 less 7% is 111.4884 -> 111.49. Per unit first would give 9.29 x 12 = 111.48.
    expect(standardPriceOf(9.99, 12, 7)).toBe(111.49);
  });

  it('a tier taking nothing off pays list', () => {
    expect(standardPriceOf(19, 6, 0)).toBe(114);
    expect(listPriceOf(19, 6)).toBe(114);
  });

  it('nothing off nothing is still nothing', () => {
    expect(standardPriceOf(0, 3, 18)).toBe(0);
  });
});
