// Mock of the `tier_price` table (architecture doc §2.2).
//
// Every row prices ONE SKU for one tier. There is no SPU-level row to fall back to —
// a SKU's price is a property of the SKU, the same way its MAP is (§2.1.2). That also
// keeps the basis honest: prices here are what the dealer pays for one of that SKU,
// so a pack SKU's row is the price of the whole pack.
//
// `minQty` is a volume break in units OF THAT SKU: `PL001-BLK-06` at minQty 2 means
// "order two 6-packs". Discounts are deliberately uneven across the catalog — apparel
// carries more margin than commodity exhaust parts, so Gold's spread over Silver is
// wider there. A single blanket percentage would prove nothing.

export interface TierPriceRow {
  sku: string;
  tierId: number;
  /** Price for one of this SKU at `minQty`+. A pack SKU's price is the whole pack. */
  price: number;
  minQty: number;
}

const GOLD = 1;
const SILVER = 2;

/** Authoring shape — flattened into `tierPrices` below, one row per tier per break. */
interface PricingSeed {
  sku: string;
  silver: number;
  gold: number;
  /** Volume break: at `breakQty`+ of this SKU, the tier pays the break price. */
  breakQty?: number;
  silverBreak?: number;
  goldBreak?: number;
}

const seeds: PricingSeed[] = [
  // ─── Exhaust — commodity parts, thin spread (Gold ~10% under Silver) ──────
  { sku: 'PL001-BLK-01', silver: 19.00, gold: 17.10, breakQty: 6, silverBreak: 18.25, goldBreak: 16.25 },
  { sku: 'PL001-BLK-06', silver: 105.00, gold: 93.60, breakQty: 2, silverBreak: 100.00, goldBreak: 88.50 },
  { sku: 'PL001-CHR-01', silver: 22.00, gold: 19.80, breakQty: 6, silverBreak: 21.00, goldBreak: 18.80 },
  { sku: 'PL001-CHR-06', silver: 120.00, gold: 106.80, breakQty: 2, silverBreak: 114.00, goldBreak: 101.00 },
  { sku: 'EX100-01', silver: 14.50, gold: 12.75, breakQty: 12, silverBreak: 13.75, goldBreak: 12.00 },
  { sku: 'EX100-02', silver: 28.00, gold: 24.50, breakQty: 6, silverBreak: 26.50, goldBreak: 23.00 },
  { sku: 'EX100-12', silver: 150.00, gold: 129.00, breakQty: 2, silverBreak: 144.00, goldBreak: 123.00 },

  // ─── Lighting — mid spread (Gold ~12%) ───────────────────────────────────
  { sku: 'LT200-WHT-01', silver: 33.00, gold: 29.25, breakQty: 4, silverBreak: 31.50, goldBreak: 27.90 },
  { sku: 'LT200-WHT-04', silver: 124.00, gold: 109.00, breakQty: 2, silverBreak: 119.00, goldBreak: 104.00 },
  { sku: 'LT201-AMB-01', silver: 31.00, gold: 27.50 },

  // ─── Jackets — high margin, wide spread (Gold ~15% under Silver) ─────────
  // Size S is overstocked and priced flat below the rest of the run, with no break.
  { sku: 'JK400-BLK-S', silver: 74.00, gold: 62.00 },
  { sku: 'JK400-BLK-M', silver: 82.00, gold: 69.50, breakQty: 6, silverBreak: 78.00, goldBreak: 65.00 },
  { sku: 'JK400-BLK-L', silver: 82.00, gold: 69.50, breakQty: 6, silverBreak: 78.00, goldBreak: 65.00 },
  { sku: 'JK400-BLK-XL', silver: 86.00, gold: 73.50, breakQty: 6, silverBreak: 82.00, goldBreak: 69.00 },
  { sku: 'JK400-BRN-M', silver: 85.00, gold: 71.75 },
  { sku: 'JK400-BRN-L', silver: 85.00, gold: 71.75 },
  { sku: 'JK400-BRN-XL', silver: 89.00, gold: 75.75 },

  // ─── Gloves — high margin, volume-driven ─────────────────────────────────
  { sku: 'GL100-BLK-S', silver: 16.50, gold: 14.00, breakQty: 12, silverBreak: 15.75, goldBreak: 13.20 },
  { sku: 'GL100-BLK-M', silver: 16.50, gold: 14.00, breakQty: 12, silverBreak: 15.75, goldBreak: 13.20 },
  { sku: 'GL100-BLK-L', silver: 16.50, gold: 14.00, breakQty: 12, silverBreak: 15.75, goldBreak: 13.20 },
  { sku: 'GL100-BLK-XL', silver: 17.50, gold: 15.00, breakQty: 12, silverBreak: 16.75, goldBreak: 14.20 },
  { sku: 'GL100-BRN-M', silver: 16.50, gold: 14.40 },
  { sku: 'GL100-BRN-L', silver: 16.50, gold: 14.40 },

  // ─── Hand Tools ──────────────────────────────────────────────────────────
  { sku: 'TL500-01', silver: 27.50, gold: 24.50, breakQty: 6, silverBreak: 26.50, goldBreak: 23.50 },
  { sku: 'TL500-06', silver: 147.00, gold: 129.00, breakQty: 2, silverBreak: 142.00, goldBreak: 124.00 },
];

export const tierPrices: TierPriceRow[] = seeds.flatMap((s) => {
  const rows: TierPriceRow[] = [
    { sku: s.sku, tierId: SILVER, price: s.silver, minQty: 1 },
    { sku: s.sku, tierId: GOLD, price: s.gold, minQty: 1 },
  ];
  if (s.breakQty !== undefined) {
    if (s.silverBreak !== undefined) rows.push({ sku: s.sku, tierId: SILVER, price: s.silverBreak, minQty: s.breakQty });
    if (s.goldBreak !== undefined) rows.push({ sku: s.sku, tierId: GOLD, price: s.goldBreak, minQty: s.breakQty });
  }
  return rows;
});

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

/**
 * Volume breaks for one SKU on one tier — every minQty above 1 that beats the
 * single-quantity price. Empty when the SKU has no volume pricing.
 */
export function getPriceBreaks(
  sku: string,
  tierId: number,
  basePrice: number,
  priceAdjustment: number,
  packQuantity: number,
): { minQty: number; price: number }[] {
  const singlePrice = resolvePrice(sku, tierId, basePrice, priceAdjustment, packQuantity, 1);

  return tierPrices
    .filter((r) => r.sku === sku && r.tierId === tierId && r.minQty > 1)
    .map((r) => ({ minQty: r.minQty, price: round2(r.price) }))
    .filter((b) => b.price < singlePrice)
    .sort((a, b) => a.minQty - b.minQty);
}

/** All tier rows for the given SKUs, for the admin pricing editor. */
export function getTierPriceRowsForSkus(skus: string[]): TierPriceRow[] {
  return tierPrices.filter((r) => skus.includes(r.sku));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
