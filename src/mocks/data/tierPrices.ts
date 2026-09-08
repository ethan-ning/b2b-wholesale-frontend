// Mock of the `tier_price` table (architecture doc §2.2).
//
// Every row prices ONE SKU for one tier. There is no SPU-level row to fall back to —
// a SKU's price is a property of the SKU, the same way its MAP is (§2.1.2). That also
// keeps the basis honest: prices here are what the dealer pays for one of that SKU,
// so a pack SKU's row is the price of the whole pack.
//
// Discounts are deliberately uneven across the catalog — apparel carries more margin
// than commodity exhaust parts, so Gold's spread over Silver is wider there. A single
// blanket percentage would prove nothing.
//
// ─── Quantity-based pricing is out of MVP scope ──────────────────────────────
// The MVP is a lookup portal with no cart, so a price conditional on ordering N is
// something a dealer cannot act on here; for parts, bulk buying is already expressed
// by pack SKUs. `minQty` is kept and pinned to 1 rather than removed, so switching
// volume breaks on later is purely additive:
//
//   MVP invariant — exactly one row per (sku, tierId), always minQty === 1.
//   To enable breaks — insert rows at minQty > 1. No column change, no unique-key
//   change, and resolvePrice already selects the right row.
//
// That is why resolvePrice still takes `quantity` and still picks the highest
// applicable minQty: with only minQty-1 rows it always lands on that row, so the
// resolution code needs no edit when breaks arrive.

export interface TierPriceRow {
  sku: string;
  tierId: number;
  /** Price for one of this SKU. A pack SKU's price is the whole pack. */
  price: number;
  /** Volume-break threshold. Always 1 in the MVP — see the note above. */
  minQty: number;
}

const GOLD = 1;
const SILVER = 2;

/** Authoring shape — flattened into `tierPrices` below, one row per tier. */
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
 * Price for one of `sku` on `tierId` when ordering `quantity` of it:
 *   1. the SKU's tier row with the highest minQty <= quantity
 *   2. failing that, `(basePrice + priceAdjustment) * packQuantity` — the SPU list
 *      price, for a SKU that has not been priced yet
 *
 * There is no SPU-level tier row in between: pricing is stated per SKU.
 */
export function resolvePrice(
  sku: string,
  tierId: number,
  basePrice: number,
  priceAdjustment: number,
  packQuantity: number,
  quantity = 1,
): number {
  const row = tierPrices
    .filter((r) => r.sku === sku && r.tierId === tierId && r.minQty <= quantity)
    .sort((a, b) => b.minQty - a.minQty)[0];

  if (row) return round2(row.price);
  return round2((basePrice + priceAdjustment) * packQuantity);
}

/** All tier rows for the given SKUs, for the admin pricing editor. */
export function getTierPriceRowsForSkus(skus: string[]): TierPriceRow[] {
  return tierPrices.filter((r) => skus.includes(r.sku));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
