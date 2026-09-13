/**
 * What a tier pays for one SKU, worked out here rather than asked of the API.
 *
 * The backend's rule stated a second time, which is normally worth refusing: two copies
 * of an arithmetic drift, and then a listing and an invoice disagree over a penny. It is
 * here so the grid can follow a base price as it is typed, instead of a save and a reload.
 *
 * Kept in one function, and tierPricing.test.ts pins it against the same cases as the
 * Kotlin test for Money.lessDiscount, so a divergence fails here and not in an order.
 */
export function listPriceOf(basePrice: number, packQuantity: number): number {
  return roundToCents(basePrice * packQuantity);
}

export function standardPriceOf(
  basePrice: number,
  packQuantity: number,
  discountPercent: number,
): number {
  // The rate is rounded to two places first, because DiscountPercent is: 12.345% is held
  // as 12.35%, and applying the raw figure gives a different cent.
  const rate = Math.round(discountPercent * 100 + 1e-9) / 100;
  // The discount comes off the price of the whole SKU. Taking it off the unit price and
  // multiplying back rounds once per unit, and a twelve-pack drifts by cents.
  return roundToCents(listPriceOf(basePrice, packQuantity) * (1 - rate / 100));
}

/**
 * Half up, to the cent — matching BigDecimal's HALF_UP rather than JavaScript's idea of
 * rounding. `(0.075).toFixed(2)` is "0.07", because 0.075 is not really 0.075; the nudge
 * below is smaller than a hundredth of a cent and puts such cases back on the right side.
 */
function roundToCents(value: number): number {
  return Math.round(value * 100 + 1e-9) / 100;
}
