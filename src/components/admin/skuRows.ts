import type { CustomerTier, TierPrice, Variant } from '../../api/types';
import { listPriceOf, standardPriceOf } from './tierPricing';

export type TierRow = {
  key: string;
  tier: CustomerTier;
  /**
   * The override, if somebody set one. Null means this SKU takes its tier's rate — which
   * is a price, not the absence of one.
   */
  price: number | null;
  /** What the tier's rate gives, from the base price currently in the form. */
  standardPrice: number;
  /** At or above the SKU's advertised floor, which leaves the dealer no margin. */
  breachesMap: boolean;
};

export type SkuRow = {
  key: string;
  variant: Variant;
  /** Base price x pack quantity. What the SKU lists at before any tier's rate. */
  listPrice: number;
  /** Empty for a withdrawn SKU: the supplier has stopped selling it, so there is no price. */
  tiers: TierRow[];
  customCount: number;
};

/** What a tier row costs, override first. */
export function effectivePrice(row: TierRow): number {
  return row.price ?? row.standardPrice;
}

/**
 * One row per SKU, each carrying what its tiers pay.
 *
 * [basePrice] is the figure in the form rather than the one last saved, so every tier
 * follows it as it is typed. Undefined while the box is empty mid-edit — the prices are
 * then unknowable rather than zero, which is what stops a tier being overridden before a
 * base price exists.
 */
export function buildSkuRows(
  variants: Variant[],
  tiers: CustomerTier[],
  book: TierPrice[],
  basePrice: number | undefined,
  overrides: Record<string, number | null> = {},
): SkuRow[] {
  const saved = new Map(book.map((r) => [`${r.sku}:${r.tierId}`, r]));

  return variants.map((variant): SkuRow => {
    const listPrice = basePrice === undefined ? 0 : listPriceOf(basePrice, variant.packQuantity);
    if (variant.status === 'DISCONTINUED') {
      return { key: variant.sku, variant, listPrice, tiers: [], customCount: 0 };
    }

    const tierRows = tiers.map((tier): TierRow => {
      const key = `${variant.sku}:${tier.id}`;
      const savedRow = saved.get(key);
      const price = key in overrides
        ? overrides[key]
        : savedRow?.customised
          ? savedRow.price
          : null;
      const standardPrice = basePrice === undefined
        ? 0
        : standardPriceOf(basePrice, variant.packQuantity, tier.discountPercent);
      const effective = price ?? standardPrice;
      return {
        key,
        tier,
        price,
        standardPrice,
        breachesMap: variant.mapPrice !== null && effective >= variant.mapPrice,
      };
    });

    return {
      key: variant.sku,
      variant,
      listPrice,
      tiers: tierRows,
      customCount: tierRows.filter((t) => t.price !== null).length,
    };
  });
}
