import type { CustomerTier, TierPrice, Variant } from '../../api/types';

export type SkuRow = {
  key: string;
  variant: Variant;
  tier: CustomerTier | null;
  minQty: number;
  /**
   * The override, if there is one. Null means this SKU takes its tier's standing rate —
   * which is a price, not an absence of one, so nothing here is "unpriced".
   */
  price: number | null;
  /** What the tier's discount alone gives. What an override is departing from. */
  standardPrice: number;
  /** At or above the SKU's advertised floor, which leaves the dealer no margin. */
  breachesMap: boolean;
};

/** What a row costs, override first. */
export function effectivePrice(row: SkuRow): number {
  return row.price ?? row.standardPrice;
}

export function buildSkuRows(
  variants: Variant[],
  tiers: CustomerTier[],
  book: TierPrice[],
): SkuRow[] {
  const byKey = new Map(book.map((r) => [`${r.sku}:${r.tierId}:${r.minQty}`, r]));
  return variants.flatMap((variant): SkuRow[] => {
    if (variant.status === 'DISCONTINUED') {
      return [{
        key: `${variant.sku}:none`, variant, tier: null, minQty: 1,
        price: null, standardPrice: 0, breachesMap: false,
      }];
    }
    return tiers.map((tier) => {
      const row = byKey.get(`${variant.sku}:${tier.id}:1`);
      return {
        key: `${variant.sku}:${tier.id}`,
        variant,
        tier,
        minQty: 1,
        // Only a deliberate override lands here; the standing rate is not an edit.
        price: row?.customised ? row.price : null,
        standardPrice: row?.standardPrice ?? 0,
        breachesMap: row?.breachesMap ?? false,
      };
    });
  });
}
