import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyRange } from './money';

describe('formatMoney', () => {
  it('always shows two decimals', () => {
    expect(formatMoney(9)).toBe('$9.00');
    expect(formatMoney(9.5)).toBe('$9.50');
    expect(formatMoney(9.499)).toBe('$9.50');
  });

  it('shows a free item as zero rather than as nothing', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });
});

describe('formatMoneyRange', () => {
  it('collapses to one figure when every SKU costs the same', () => {
    expect(formatMoneyRange([12.5, 12.5, 12.5])).toBe('$12.50');
  });

  it('spans low to high when they differ', () => {
    expect(formatMoneyRange([24.81, 9.68, 13.2])).toBe('$9.68 – $24.81');
  });

  it('returns null with nothing to summarise, so a caller can omit the line', () => {
    // Distinct from "$0.00": a product with no MAP at all should show no MAP row, not
    // one claiming it is free.
    expect(formatMoneyRange([])).toBeNull();
  });

  it('handles a single amount', () => {
    expect(formatMoneyRange([7])).toBe('$7.00');
  });
});
