import type { Product } from '../../api/types';
import { resolvePrice } from './tierPrices';

const now = new Date().toISOString();

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// A SKU under an SPU. `value` is the differentiator shown in the variant column and
// used as the SKU code suffix — a size for apparel, a pack quantity for parts.
// `packQty` stays the unit count (1 for apparel) since pricing and MOQ key off it.
interface VariantSeed {
  sku: string;
  value: string;
  packQty: number;
  upc: string;
  available: number;
  incoming: number;
  /**
   * Advertised price for one of this SKU — required, never inherited. On a size SKU
   * that is one garment; on a pack SKU it is the whole pack, so a 6-pack of a $39.99
   * part advertises at $239.94.
   */
  map: number;
}

function makeProduct(
  id: number,
  spuCode: string,
  name: string,
  brand: string,
  basePrice: number,
  locationCode: string,
  variantAxis: string,
  categoryId: number,
  categoryName: string,
  description: string,
  attributes: Record<string, string>,
  imageUrl: string,
  variants: VariantSeed[],
  tierId: number,
): Product {
  return {
    id,
    spuCode,
    name,
    brand,
    description,
    baseWholesalePrice: basePrice,
    locationCode,
    variantAxis,
    attributes,
    status: 'ACTIVE',
    categories: [{ id: categoryId, name: categoryName, isPrimary: true }],
    images: [{ id: id * 10, url: imageUrl, altText: name, sortOrder: 0 }],
    variants: variants.map((v, i) => ({
      id: id * 100 + i,
      sku: v.sku,
      variantValue: v.value,
      packQuantity: v.packQty,
      upc: v.upc,
      weight: 0.5 + i * 0.2,
      status: 'ACTIVE',
      mapPrice: v.map,
      // tier_price rows state the price of one of this SKU, so a pack SKU's price is
      // the whole pack — the same basis as its MAP. Per unit is derived for display.
      tierPrice: resolvePrice(v.sku, tierId, basePrice, v.packQty),
      unitPrice: round2(resolvePrice(v.sku, tierId, basePrice, v.packQty) / v.packQty),
      inventory: {
        availableStock: v.available,
        incomingStock: v.incoming,
        updatedAt: now,
      },
    })),
  };
}

export function getProducts(tierId: number): Product[] {
  return [
    // ─── Exhaust (category 11) — pack-quantity SKUs ──────────────────────────
    makeProduct(1, 'PL001-BLK', 'Muffler Extension Pipe - Black', 'ProLine', 19.00, 'A1-1', 'Pack Qty', 11, 'Exhaust',
      'Heavy-duty stainless steel muffler extension pipe, black powder-coat finish.',
      { Color: 'Black', Material: 'Stainless Steel', Length: '18 inch' },
      'https://placehold.co/400x300/1a1a1a/ffffff?text=Muffler+Black',
      [
        { sku: 'PL001-BLK-01', value: '1', packQty: 1, map: 39.99, upc: '012345678901', available: 25, incoming: 0 },
        { sku: 'PL001-BLK-06', value: '6', packQty: 6, map: 239.94, upc: '012345678902', available: 4, incoming: 12 },
      ], tierId),

    makeProduct(2, 'PL001-CHR', 'Muffler Extension Pipe - Chrome', 'ProLine', 22.00, 'A1-2', 'Pack Qty', 11, 'Exhaust',
      'Heavy-duty stainless steel muffler extension pipe, mirror chrome finish.',
      { Color: 'Chrome', Material: 'Stainless Steel', Length: '18 inch' },
      'https://placehold.co/400x300/c0c0c0/333333?text=Muffler+Chrome',
      [
        { sku: 'PL001-CHR-01', value: '1', packQty: 1, map: 44.99, upc: '012345678911', available: 0, incoming: 30 },
        { sku: 'PL001-CHR-06', value: '6', packQty: 6, map: 269.94, upc: '012345678912', available: 2, incoming: 0 },
      ], tierId),

    makeProduct(3, 'EX100', 'Performance Exhaust Tip', 'TurboKing', 14.50, 'A2-1', 'Pack Qty', 11, 'Exhaust',
      '4-inch performance exhaust tip, universal fit.',
      { Diameter: '4 inch', Finish: 'Polished', Material: 'Aluminized Steel' },
      'https://placehold.co/400x300/888888/ffffff?text=Exhaust+Tip',
      [
        { sku: 'EX100-01', value: '1', packQty: 1, map: 29.99, upc: '023456789001', available: 18, incoming: 0 },
        { sku: 'EX100-02', value: '2', packQty: 2, map: 59.98, upc: '023456789002', available: 7, incoming: 20 },
        { sku: 'EX100-12', value: '12', packQty: 12, map: 359.88, upc: '023456789003', available: 1, incoming: 0 },
      ], tierId),

    // ─── Lighting (category 12) — pack-quantity SKUs ─────────────────────────
    makeProduct(4, 'LT200-WHT', 'LED Work Light Bar - White', 'LumenPro', 34.00, 'B3-1', 'Pack Qty', 12, 'Lighting',
      '20-inch LED light bar, white, waterproof IP67 rating.',
      { Color: 'White', Wattage: '120W', IP_Rating: 'IP67', Length: '20 inch' },
      'https://placehold.co/400x300/f0f0f0/333333?text=LED+Light+Bar',
      [
        { sku: 'LT200-WHT-01', value: '1', packQty: 1, map: 69.99, upc: '034567890001', available: 15, incoming: 0 },
        { sku: 'LT200-WHT-04', value: '4', packQty: 4, map: 279.96, upc: '034567890002', available: 3, incoming: 8 },
      ], tierId),

    makeProduct(5, 'LT201-AMB', 'LED Light Bar - Amber', 'LumenPro', 32.00, 'B3-2', 'Pack Qty', 12, 'Lighting',
      '20-inch LED light bar, amber lens for fog/dust conditions.',
      { Color: 'Amber', Wattage: '120W', IP_Rating: 'IP67', Length: '20 inch' },
      'https://placehold.co/400x300/ffb300/333333?text=Amber+LED',
      [
        { sku: 'LT201-AMB-01', value: '1', packQty: 1, map: 64.99, upc: '034567890011', available: 0, incoming: 0 },
      ], tierId),

    // ─── Jackets (category 21) — size SKUs ───────────────────────────────────
    // One SPU per color; sizes are SKUs beneath it. Each size states its own MAP —
    // identical across S/M/L here, higher on XL to track its wholesale premium.
    makeProduct(6, 'JK400-BLK', 'Motorcycle Leather Jacket - Black', 'RiderEdge', 89.00, 'C1-1', 'Size', 21, 'Jackets',
      'Premium cowhide leather motorcycle jacket, CE-rated armor pockets.',
      { Color: 'Black', Material: 'Cowhide Leather', CE_Armor: 'Level 1' },
      'https://placehold.co/400x300/111111/ffffff?text=Jacket+Black',
      [
        { sku: 'JK400-BLK-S', value: 'S', packQty: 1, map: 179.99, upc: '045678900001', available: 12, incoming: 0 },
        { sku: 'JK400-BLK-M', value: 'M', packQty: 1, map: 179.99, upc: '045678900002', available: 8, incoming: 20 },
        { sku: 'JK400-BLK-L', value: 'L', packQty: 1, map: 179.99, upc: '045678900003', available: 3, incoming: 0 },
        { sku: 'JK400-BLK-XL', value: 'XL', packQty: 1, map: 189.99, upc: '045678900004', available: 0, incoming: 24 },
      ], tierId),

    makeProduct(7, 'JK400-BRN', 'Motorcycle Leather Jacket - Brown', 'RiderEdge', 92.00, 'C1-2', 'Size', 21, 'Jackets',
      'Premium cowhide leather motorcycle jacket, brown, CE-rated armor pockets.',
      { Color: 'Brown', Material: 'Cowhide Leather', CE_Armor: 'Level 1' },
      'https://placehold.co/400x300/6d4c41/ffffff?text=Jacket+Brown',
      [
        { sku: 'JK400-BRN-M', value: 'M', packQty: 1, map: 184.99, upc: '045678900011', available: 7, incoming: 0 },
        { sku: 'JK400-BRN-L', value: 'L', packQty: 1, map: 184.99, upc: '045678900012', available: 5, incoming: 0 },
        { sku: 'JK400-BRN-XL', value: 'XL', packQty: 1, map: 194.99, upc: '045678900013', available: 2, incoming: 10 },
      ], tierId),

    // ─── Gloves (category 22) — size SKUs ────────────────────────────────────
    makeProduct(8, 'GL100-BLK', 'Riding Gloves - Black', 'RiderEdge', 18.00, 'C2-1', 'Size', 22, 'Gloves',
      'Touchscreen-compatible leather riding gloves, reinforced palm.',
      { Color: 'Black', Material: 'Genuine Leather', Feature: 'Touchscreen Compatible' },
      'https://placehold.co/400x300/222222/ffffff?text=Gloves+Black',
      [
        { sku: 'GL100-BLK-S', value: 'S', packQty: 1, map: 36.99, upc: '056789000001', available: 22, incoming: 0 },
        { sku: 'GL100-BLK-M', value: 'M', packQty: 1, map: 36.99, upc: '056789000002', available: 14, incoming: 0 },
        { sku: 'GL100-BLK-L', value: 'L', packQty: 1, map: 36.99, upc: '056789000003', available: 6, incoming: 10 },
        { sku: 'GL100-BLK-XL', value: 'XL', packQty: 1, map: 39.99, upc: '056789000004', available: 0, incoming: 15 },
      ], tierId),

    makeProduct(9, 'GL100-BRN', 'Riding Gloves - Brown', 'RiderEdge', 18.00, 'C2-2', 'Size', 22, 'Gloves',
      'Touchscreen-compatible leather riding gloves, brown, reinforced palm.',
      { Color: 'Brown', Material: 'Genuine Leather', Feature: 'Touchscreen Compatible' },
      'https://placehold.co/400x300/5d4037/ffffff?text=Gloves+Brown',
      [
        { sku: 'GL100-BRN-M', value: 'M', packQty: 1, map: 36.99, upc: '056789000011', available: 11, incoming: 0 },
        { sku: 'GL100-BRN-L', value: 'L', packQty: 1, map: 36.99, upc: '056789000012', available: 4, incoming: 12 },
      ], tierId),

    // ─── Hand Tools (category 31) — pack-quantity SKUs ───────────────────────
    makeProduct(10, 'TL500', 'Socket Wrench Set', 'GripMaster', 28.00, 'D1-1', 'Pack Qty', 31, 'Hand Tools',
      '40-piece metric/SAE socket wrench set with case.',
      { Pieces: '40', Drive_Size: '3/8 inch', Case: 'Blow-mold case' },
      'https://placehold.co/400x300/f57c00/ffffff?text=Socket+Set',
      [
        { sku: 'TL500-01', value: '1', packQty: 1, map: 55.99, upc: '067890100001', available: 9, incoming: 0 },
        { sku: 'TL500-06', value: '6', packQty: 6, map: 335.94, upc: '067890100002', available: 2, incoming: 6 },
      ], tierId),
  ];
}
