import type { CustomerTier, TierPrice, Variant } from '../../api/types';

export type SkuRow = {
  key: string;
  variant: Variant;
  tier: CustomerTier | null;
  minQty: number;
  /**
   * Null for a row nobody has filled in. A blank leaves the SKU unpriced; a zero would
   * price it at nothing and let it go on sale for free.
   */
  price: number | null;
};

export function buildSkuRows(
  variants: Variant[],
  tiers: CustomerTier[],
  existing: TierPrice[],
): SkuRow[] {
  const priced = new Map(existing.map((r) => [`${r.sku}:${r.tierId}:${r.minQty}`, r]));
  return variants.flatMap((variant): SkuRow[] => {
    if (variant.status === 'DISCONTINUED') {
      return [{ key: `${variant.sku}:none`, variant, tier: null, minQty: 1, price: null }];
    }
    return tiers.map((tier) => ({
      key: `${variant.sku}:${tier.id}`,
      variant,
      tier,
      minQty: 1,
      price: priced.get(`${variant.sku}:${tier.id}:1`)?.price ?? null,
    }));
  });
}

/** Epoch means the stock sync has never reached this SKU, not that it synced in 1970. */
