import type { CustomerTier, TierPrice, Variant } from '../../api/types';
import { standardPriceOf } from './tierPricing';

export type TierRow = {
  key: string;
  tier: CustomerTier;
  /**
   * The override, if somebody set one. Null means this SKU takes its tier's rate — which
   * is a price, not the absence of one.
   */
  price: number | null;
  /** What the tier's discount gives, from the default price currently in the form. */
  standardPrice: number | null;
  /** At or above the SKU's advertised floor, which leaves the dealer no margin. */
  breachesMap: boolean;
};

export type SkuRow = {
  key: string;
  variant: Variant;
  /**
   * The price every other tier is worked out from. Null until somebody sets one, and
   * while it is null the SKU has no price at any tier.
   */
  defaultPrice: number | null;
  /** Empty for a withdrawn SKU: the supplier has stopped selling it, so there is no price. */
  tiers: TierRow[];
  customCount: number;
};

/**
 * Whether this tier has actually been given a different price.
 *
 * A figure equal to what the discount gives is not a departure from it, however it got
 * into the box — so opening the box to look does not make a price custom.
 */
export function isCustom(row: TierRow): boolean {
  return row.price !== null && row.price !== row.standardPrice;
}

/**
 * One row per SKU, each carrying what its tiers pay.
 *
 * Everything is worked out from the figures in the form rather than the ones last saved,
 * so a default price moves its tiers as it is typed. [edits] holds what has been changed
 * and not yet saved, keyed "sku:tierId" — including the default price, which is just the
 * anchor tier's entry.
 */
export function buildSkuRows(
  variants: Variant[],
  tiers: CustomerTier[],
  book: TierPrice[],
  edits: Record<string, number | null> = {},
): SkuRow[] {
  const saved = new Map(book.map((r) => [`${r.sku}:${r.tierId}`, r]));
  const anchor = tiers.find((t) => t.anchor);

  /** What is in the form for this SKU and tier: the edit if there is one, else the saved. */
  const stated = (sku: string, tier: CustomerTier): number | null => {
    const key = `${sku}:${tier.id}`;
    if (key in edits) return edits[key];
    const row = saved.get(key);
    if (!row) return null;
    return tier.anchor ? row.price : (row.customised ? row.price : null);
  };

  return variants.map((variant): SkuRow => {
    const defaultPrice = anchor ? stated(variant.sku, anchor) : null;

    if (variant.status === 'DISCONTINUED') {
      return { key: variant.sku, variant, defaultPrice, tiers: [], customCount: 0 };
    }

    const tierRows = tiers.filter((t) => !t.anchor).map((tier): TierRow => {
      const price = stated(variant.sku, tier);
      const standardPrice = defaultPrice === null
        ? null
        : standardPriceOf(defaultPrice, tier.discountPercent);
      const effective = price ?? standardPrice;
      return {
        key: `${variant.sku}:${tier.id}`,
        tier,
        price,
        standardPrice,
        breachesMap: effective !== null && variant.mapPrice !== null && effective >= variant.mapPrice,
      };
    });

    return {
      key: variant.sku,
      variant,
      defaultPrice,
      tiers: tierRows,
      customCount: tierRows.filter(isCustom).length,
    };
  });
}
