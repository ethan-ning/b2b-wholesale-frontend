import type { Product } from '../../api/types';

const now = new Date().toISOString();

// Gold tier (tierId=1) gets lower prices
function goldPrice(base: number) { return Math.round(base * 0.85 * 100) / 100; }
function silverPrice(base: number) { return base; }

function makeProduct(
  id: number,
  spuCode: string,
  name: string,
  brand: string,
  basePrice: number,
  mapPrice: number,
  locationCode: string,
  categoryId: number,
  categoryName: string,
  description: string,
  attributes: Record<string, string>,
  imageUrl: string,
  variants: { sku: string; packQty: number; priceAdj: number; upc: string; available: number; incoming: number }[],
  tierId: number,
): Product {
  return {
    id,
    spuCode,
    name,
    brand,
    description,
    baseWholesalePrice: basePrice,
    mapPrice,
    locationCode,
    attributes,
    status: 'ACTIVE',
    categories: [{ id: categoryId, name: categoryName, isPrimary: true }],
    images: [{ id: id * 10, url: imageUrl, altText: name, sortOrder: 0 }],
    variants: variants.map((v, i) => ({
      id: id * 100 + i,
      sku: v.sku,
      packQuantity: v.packQty,
      priceAdjustment: v.priceAdj,
      upc: v.upc,
      weight: 0.5 + i * 0.2,
      status: 'ACTIVE',
      tierPrice: tierId === 1 ? goldPrice(basePrice + v.priceAdj) : silverPrice(basePrice + v.priceAdj),
      inventory: {
        availableStock: v.available,
        incomingStock: v.incoming,
        reservedStock: 0,
        updatedAt: now,
      },
    })),
  };
}

export function getProducts(tierId: number): Product[] {
  return [
    // Exhaust (category 11)
    makeProduct(1, 'PL001-BLK', 'Muffler Extension Pipe - Black', 'ProLine', 19.00, 39.99, 'A1-1', 11, 'Exhaust',
      'Heavy-duty stainless steel muffler extension pipe, black powder-coat finish.',
      { Color: 'Black', Material: 'Stainless Steel', Length: '18 inch' },
      'https://placehold.co/400x300/1a1a1a/ffffff?text=Muffler+Black',
      [
        { sku: 'PL001-BLK-01', packQty: 1, priceAdj: 0, upc: '012345678901', available: 25, incoming: 0 },
        { sku: 'PL001-BLK-06', packQty: 6, priceAdj: -1.50, upc: '012345678902', available: 4, incoming: 12 },
      ], tierId),

    makeProduct(2, 'PL001-CHR', 'Muffler Extension Pipe - Chrome', 'ProLine', 22.00, 44.99, 'A1-2', 11, 'Exhaust',
      'Heavy-duty stainless steel muffler extension pipe, mirror chrome finish.',
      { Color: 'Chrome', Material: 'Stainless Steel', Length: '18 inch' },
      'https://placehold.co/400x300/c0c0c0/333333?text=Muffler+Chrome',
      [
        { sku: 'PL001-CHR-01', packQty: 1, priceAdj: 0, upc: '012345678911', available: 0, incoming: 30 },
        { sku: 'PL001-CHR-06', packQty: 6, priceAdj: -2.00, upc: '012345678912', available: 2, incoming: 0 },
      ], tierId),

    makeProduct(3, 'EX100', 'Performance Exhaust Tip', 'TurboKing', 14.50, 29.99, 'A2-1', 11, 'Exhaust',
      '4-inch performance exhaust tip, universal fit.',
      { Diameter: '4 inch', Finish: 'Polished', Material: 'Aluminized Steel' },
      'https://placehold.co/400x300/888888/ffffff?text=Exhaust+Tip',
      [
        { sku: 'EX100-01', packQty: 1, priceAdj: 0, upc: '023456789001', available: 18, incoming: 0 },
        { sku: 'EX100-02', packQty: 2, priceAdj: -0.50, upc: '023456789002', available: 7, incoming: 20 },
        { sku: 'EX100-12', packQty: 12, priceAdj: -2.00, upc: '023456789003', available: 1, incoming: 0 },
      ], tierId),

    // Lighting (category 12)
    makeProduct(4, 'LT200-WHT', 'LED Work Light Bar - White', 'LumenPro', 34.00, 69.99, 'B3-1', 12, 'Lighting',
      '20-inch LED light bar, white, waterproof IP67 rating.',
      { Color: 'White', Wattage: '120W', IP_Rating: 'IP67', Length: '20 inch' },
      'https://placehold.co/400x300/f0f0f0/333333?text=LED+Light+Bar',
      [
        { sku: 'LT200-WHT-01', packQty: 1, priceAdj: 0, upc: '034567890001', available: 15, incoming: 0 },
        { sku: 'LT200-WHT-04', packQty: 4, priceAdj: -2.00, upc: '034567890002', available: 3, incoming: 8 },
      ], tierId),

    makeProduct(5, 'LT201-AMB', 'LED Light Bar - Amber', 'LumenPro', 32.00, 64.99, 'B3-2', 12, 'Lighting',
      '20-inch LED light bar, amber lens for fog/dust conditions.',
      { Color: 'Amber', Wattage: '120W', IP_Rating: 'IP67', Length: '20 inch' },
      'https://placehold.co/400x300/ffb300/333333?text=Amber+LED',
      [
        { sku: 'LT201-AMB-01', packQty: 1, priceAdj: 0, upc: '034567890011', available: 0, incoming: 0 },
      ], tierId),

    // Jackets (category 21)
    makeProduct(6, 'JK400-BLK-S', 'Motorcycle Leather Jacket - Black S', 'RiderEdge', 89.00, 179.99, 'C1-1', 21, 'Jackets',
      'Premium cowhide leather motorcycle jacket, CE-rated armor pockets, small size.',
      { Color: 'Black', Material: 'Cowhide Leather', Size: 'S', CE_Armor: 'Level 1' },
      'https://placehold.co/400x300/111111/ffffff?text=Jacket+S',
      [
        { sku: 'JK400-BLK-S-01', packQty: 1, priceAdj: 0, upc: '045678900001', available: 12, incoming: 0 },
      ], tierId),

    makeProduct(7, 'JK400-BLK-M', 'Motorcycle Leather Jacket - Black M', 'RiderEdge', 89.00, 179.99, 'C1-1', 21, 'Jackets',
      'Premium cowhide leather motorcycle jacket, CE-rated armor pockets, medium size.',
      { Color: 'Black', Material: 'Cowhide Leather', Size: 'M', CE_Armor: 'Level 1' },
      'https://placehold.co/400x300/111111/ffffff?text=Jacket+M',
      [
        { sku: 'JK400-BLK-M-01', packQty: 1, priceAdj: 0, upc: '045678900002', available: 8, incoming: 20 },
      ], tierId),

    makeProduct(8, 'JK400-BRN-L', 'Motorcycle Leather Jacket - Brown L', 'RiderEdge', 92.00, 184.99, 'C1-2', 21, 'Jackets',
      'Premium cowhide leather motorcycle jacket, brown, large size.',
      { Color: 'Brown', Material: 'Cowhide Leather', Size: 'L', CE_Armor: 'Level 1' },
      'https://placehold.co/400x300/6d4c41/ffffff?text=Jacket+Brown+L',
      [
        { sku: 'JK400-BRN-L-01', packQty: 1, priceAdj: 0, upc: '045678900011', available: 5, incoming: 0 },
      ], tierId),

    // Gloves (category 22)
    makeProduct(9, 'GL100-BLK', 'Riding Gloves - Black', 'RiderEdge', 18.00, 36.99, 'C2-1', 22, 'Gloves',
      'Touchscreen-compatible leather riding gloves, reinforced palm.',
      { Color: 'Black', Material: 'Genuine Leather', Feature: 'Touchscreen Compatible' },
      'https://placehold.co/400x300/222222/ffffff?text=Gloves',
      [
        { sku: 'GL100-BLK-SM', packQty: 1, priceAdj: 0, upc: '056789000001', available: 22, incoming: 0 },
        { sku: 'GL100-BLK-LG', packQty: 1, priceAdj: 0, upc: '056789000002', available: 6, incoming: 10 },
        { sku: 'GL100-BLK-XL', packQty: 1, priceAdj: 1.00, upc: '056789000003', available: 0, incoming: 15 },
      ], tierId),

    // Hand Tools (category 31)
    makeProduct(10, 'TL500', 'Socket Wrench Set', 'GripMaster', 28.00, 55.99, 'D1-1', 31, 'Hand Tools',
      '40-piece metric/SAE socket wrench set with case.',
      { Pieces: '40', Drive_Size: '3/8 inch', Case: 'Blow-mold case' },
      'https://placehold.co/400x300/f57c00/ffffff?text=Socket+Set',
      [
        { sku: 'TL500-01', packQty: 1, priceAdj: 0, upc: '067890100001', available: 9, incoming: 0 },
        { sku: 'TL500-06', packQty: 6, priceAdj: -3.00, upc: '067890100002', available: 2, incoming: 6 },
      ], tierId),
  ];
}
