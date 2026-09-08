// Mock of the `tier_price` table (architecture doc §2.2).
//
// A row prices one tier, either for a whole SPU (`sku: null`) or for one specific SKU
// (`sku` set — an override that wins over the SPU row). `minQty` gives volume breaks:
// the row with the highest minQty <= the ordered quantity applies.
//
// Discounts are deliberately uneven across the catalog — apparel carries more margin
// than commodity exhaust parts, so Gold's spread over Silver is wider there. A single
// blanket percentage would make every product show the same gap and prove nothing.

export interface TierPriceRow {
  spuCode: string;
  /** null = SPU-level row, applies to every SKU under it. Set = SKU-level override. */
  sku: string | null;
  tierId: number;
  price: number;
  minQty: number;
}

const GOLD = 1;
const SILVER = 2;

export const tierPrices: TierPriceRow[] = [
  // ─── Exhaust — commodity parts, thin spread (Gold ~10% under Silver) ──────
  { spuCode: 'PL001-BLK', sku: null, tierId: SILVER, price: 19.00, minQty: 1 },
  { spuCode: 'PL001-BLK', sku: null, tierId: SILVER, price: 18.25, minQty: 6 },
  { spuCode: 'PL001-BLK', sku: null, tierId: GOLD, price: 17.10, minQty: 1 },
  { spuCode: 'PL001-BLK', sku: null, tierId: GOLD, price: 16.25, minQty: 6 },

  { spuCode: 'PL001-CHR', sku: null, tierId: SILVER, price: 22.00, minQty: 1 },
  { spuCode: 'PL001-CHR', sku: null, tierId: SILVER, price: 21.00, minQty: 6 },
  { spuCode: 'PL001-CHR', sku: null, tierId: GOLD, price: 19.80, minQty: 1 },
  { spuCode: 'PL001-CHR', sku: null, tierId: GOLD, price: 18.80, minQty: 6 },

  { spuCode: 'EX100', sku: null, tierId: SILVER, price: 14.50, minQty: 1 },
  { spuCode: 'EX100', sku: null, tierId: SILVER, price: 13.75, minQty: 12 },
  { spuCode: 'EX100', sku: null, tierId: GOLD, price: 12.75, minQty: 1 },
  { spuCode: 'EX100', sku: null, tierId: GOLD, price: 12.00, minQty: 12 },

  // ─── Lighting — mid spread (Gold ~12%) ───────────────────────────────────
  { spuCode: 'LT200-WHT', sku: null, tierId: SILVER, price: 33.00, minQty: 1 },
  { spuCode: 'LT200-WHT', sku: null, tierId: SILVER, price: 31.50, minQty: 4 },
  { spuCode: 'LT200-WHT', sku: null, tierId: GOLD, price: 29.25, minQty: 1 },
  { spuCode: 'LT200-WHT', sku: null, tierId: GOLD, price: 27.90, minQty: 4 },

  { spuCode: 'LT201-AMB', sku: null, tierId: SILVER, price: 31.00, minQty: 1 },
  { spuCode: 'LT201-AMB', sku: null, tierId: GOLD, price: 27.50, minQty: 1 },

  // ─── Jackets — high margin, wide spread (Gold ~15% under Silver) ─────────
  { spuCode: 'JK400-BLK', sku: null, tierId: SILVER, price: 82.00, minQty: 1 },
  { spuCode: 'JK400-BLK', sku: null, tierId: SILVER, price: 78.00, minQty: 6 },
  { spuCode: 'JK400-BLK', sku: null, tierId: GOLD, price: 69.50, minQty: 1 },
  { spuCode: 'JK400-BLK', sku: null, tierId: GOLD, price: 65.00, minQty: 6 },
  // SKU-level override — size S is overstocked and discounted for both tiers.
  // Exercises step 1 of resolve_price: a SKU row wins outright and the SPU's
  // price_adjustment is NOT re-applied on top of it.
  { spuCode: 'JK400-BLK', sku: 'JK400-BLK-S', tierId: SILVER, price: 74.00, minQty: 1 },
  { spuCode: 'JK400-BLK', sku: 'JK400-BLK-S', tierId: GOLD, price: 62.00, minQty: 1 },

  { spuCode: 'JK400-BRN', sku: null, tierId: SILVER, price: 85.00, minQty: 1 },
  { spuCode: 'JK400-BRN', sku: null, tierId: GOLD, price: 71.75, minQty: 1 },

  // ─── Gloves — high margin, volume-driven ─────────────────────────────────
  { spuCode: 'GL100-BLK', sku: null, tierId: SILVER, price: 16.50, minQty: 1 },
  { spuCode: 'GL100-BLK', sku: null, tierId: SILVER, price: 15.75, minQty: 12 },
  { spuCode: 'GL100-BLK', sku: null, tierId: GOLD, price: 14.00, minQty: 1 },
  { spuCode: 'GL100-BLK', sku: null, tierId: GOLD, price: 13.20, minQty: 12 },

  { spuCode: 'GL100-BRN', sku: null, tierId: SILVER, price: 16.50, minQty: 1 },
  { spuCode: 'GL100-BRN', sku: null, tierId: GOLD, price: 14.40, minQty: 1 },

  // ─── Hand Tools ──────────────────────────────────────────────────────────
  { spuCode: 'TL500', sku: null, tierId: SILVER, price: 27.50, minQty: 1 },
  { spuCode: 'TL500', sku: null, tierId: GOLD, price: 24.50, minQty: 1 },
  { spuCode: 'TL500', sku: null, tierId: GOLD, price: 23.50, minQty: 6 },

  // No rows for a hypothetical unpriced SPU — resolvePrice then falls through to
  // step 3, base_wholesale_price + price_adjustment.
];

/**
 * resolve_price from architecture doc §2.2 — most specific match wins:
 *   1. SKU-level tier row (highest minQty <= quantity)      → price as-is
 *   2. SPU-level tier row (highest minQty <= quantity)      → price + priceAdjustment
 *   3. base wholesale price                                 → base + priceAdjustment
 *
 * priceAdjustment is a delta from the SPU price (schema comment on
 * `product_variant.price_adjustment`), so it applies to steps 2 and 3 but not to a
 * SKU-level row, which already states that SKU's full price.
 */
export function resolvePrice(
  spuCode: string,
  sku: string,
  tierId: number,
  basePrice: number,
  priceAdjustment: number,
  quantity = 1,
): number {
  const applicable = (rows: TierPriceRow[]) =>
    rows
      .filter((r) => r.tierId === tierId && r.minQty <= quantity)
      .sort((a, b) => b.minQty - a.minQty)[0];

  const spuRows = tierPrices.filter((r) => r.spuCode === spuCode);

  const skuRow = applicable(spuRows.filter((r) => r.sku === sku));
  if (skuRow) return round2(skuRow.price);

  const spuRow = applicable(spuRows.filter((r) => r.sku === null));
  if (spuRow) return round2(spuRow.price + priceAdjustment);

  return round2(basePrice + priceAdjustment);
}

/**
 * Volume breaks for one SKU on one tier — the resolved price at every minQty above 1
 * that this SKU can reach. Empty when the SKU has no volume pricing.
 */
export function getPriceBreaks(
  spuCode: string,
  sku: string,
  tierId: number,
  basePrice: number,
  priceAdjustment: number,
): { minQty: number; price: number }[] {
  const quantities = [
    ...new Set(
      tierPrices
        .filter((r) => r.spuCode === spuCode && r.tierId === tierId && (r.sku === null || r.sku === sku))
        .map((r) => r.minQty)
        .filter((q) => q > 1),
    ),
  ].sort((a, b) => a - b);

  const unitPrice = resolvePrice(spuCode, sku, tierId, basePrice, priceAdjustment, 1);

  return quantities
    .map((minQty) => ({
      minQty,
      price: resolvePrice(spuCode, sku, tierId, basePrice, priceAdjustment, minQty),
    }))
    .filter((b) => b.price < unitPrice);
}

/** All tier rows for an SPU, for the admin pricing editor. */
export function getTierPriceRows(spuCode: string): TierPriceRow[] {
  return tierPrices.filter((r) => r.spuCode === spuCode);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
