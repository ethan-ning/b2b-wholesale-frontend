// Mock of the `tier_price` table. One row per SKU per tier — no SPU-level row to fall
// back to, and a pack SKU's price is the whole pack. See architecture doc §2.2.
//
// `minQty` is pinned to 1: quantity-based pricing is out of MVP scope but the field
// and resolvePrice's `quantity` argument are kept, so enabling breaks later is just
// inserting rows at minQty > 1. See §2.2.1.
//
// Spreads are deliberately uneven — apparel carries more margin than exhaust parts.

export interface TierPriceRow {
  sku: string;
  tierId: number;
  price: number;
  minQty: number;
}

const GOLD = 1;
const SILVER = 2;

interface PricingSeed {
  sku: string;
  silver: number;
  gold: number;
}

const seeds: PricingSeed[] = [
  // ─── Exhaust — commodity parts, thin spread (Gold ~10% under Silver) ──────
  { sku: 'PL001-BLK-01', silver: 19.00, gold: 17.10 },
  { sku: 'PL001-BLK-06', silver: 105.00, gold: 93.60 },
  { sku: 'PL001-CHR-01', silver: 22.00, gold: 19.80 },
  { sku: 'PL001-CHR-06', silver: 120.00, gold: 106.80 },
  { sku: 'EX100-01', silver: 14.50, gold: 12.75 },
  { sku: 'EX100-02', silver: 28.00, gold: 24.50 },
  { sku: 'EX100-12', silver: 150.00, gold: 129.00 },

  // ─── Lighting — mid spread (Gold ~12%) ───────────────────────────────────
  { sku: 'LT200-WHT-01', silver: 33.00, gold: 29.25 },
  { sku: 'LT200-WHT-04', silver: 124.00, gold: 109.00 },
  { sku: 'LT201-AMB-01', silver: 31.00, gold: 27.50 },

  // ─── Jackets — high margin, wide spread (Gold ~15% under Silver) ─────────
  // Size S is overstocked and priced flat below the rest of the run, with no break.
  { sku: 'JK400-BLK-S', silver: 74.00, gold: 62.00 },
  { sku: 'JK400-BLK-M', silver: 82.00, gold: 69.50 },
  { sku: 'JK400-BLK-L', silver: 82.00, gold: 69.50 },
  { sku: 'JK400-BLK-XL', silver: 86.00, gold: 73.50 },
  { sku: 'JK400-BRN-M', silver: 85.00, gold: 71.75 },
  { sku: 'JK400-BRN-L', silver: 85.00, gold: 71.75 },
  { sku: 'JK400-BRN-XL', silver: 89.00, gold: 75.75 },

  // ─── Gloves — high margin, volume-driven ─────────────────────────────────
  { sku: 'GL100-BLK-S', silver: 16.50, gold: 14.00 },
  { sku: 'GL100-BLK-M', silver: 16.50, gold: 14.00 },
  { sku: 'GL100-BLK-L', silver: 16.50, gold: 14.00 },
  { sku: 'GL100-BLK-XL', silver: 17.50, gold: 15.00 },
  { sku: 'GL100-BRN-M', silver: 16.50, gold: 14.40 },
  { sku: 'GL100-BRN-L', silver: 16.50, gold: 14.40 },

  // ─── Hand Tools ──────────────────────────────────────────────────────────
  { sku: 'TL500-01', silver: 27.50, gold: 24.50 },
  { sku: 'TL500-06', silver: 147.00, gold: 129.00 },
];

export const tierPrices: TierPriceRow[] = seeds.flatMap((s) => [
  { sku: s.sku, tierId: SILVER, price: s.silver, minQty: 1 },
  { sku: s.sku, tierId: GOLD, price: s.gold, minQty: 1 },
]);

/**
 * Price for one of `sku` on `tierId`: the SKU's tier row with the highest
 * `minQty <= quantity`, else list price for a SKU nobody has priced.
 */
export function resolvePrice(
  sku: string,
  tierId: number,
  basePrice: number,
  packQuantity: number,
  quantity = 1,
): number {
  const row = tierPrices
    .filter((r) => r.sku === sku && r.tierId === tierId && r.minQty <= quantity)
    .sort((a, b) => b.minQty - a.minQty)[0];

  if (row) return round2(row.price);
  return round2(basePrice * packQuantity);
}

/** All tier rows for the given SKUs, for the admin pricing editor. */
export function getTierPriceRowsForSkus(skus: string[]): TierPriceRow[] {
  return tierPrices.filter((r) => skus.includes(r.sku));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
