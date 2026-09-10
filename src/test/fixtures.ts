import type { Category, LoginResponse, Product, Variant } from '../api/types';

/**
 * A catalogue small enough to reason about and shaped like the real one: three category
 * levels, pack SKUs alongside singles, and stock that is present, low, absent and
 * inbound — because those are the states the UI renders differently.
 */

export const DEALER: LoginResponse = {
  token: 'dealer-token',
  user: {
    id: 1,
    email: 'dealer1@example.com',
    name: 'Gold Dealer',
    companyName: 'Johnson Auto Supply',
    tierId: 1,
    tierName: 'Gold',
    mustChangePassword: false,
  },
};

export const DEALER_MUST_CHANGE: LoginResponse = {
  ...DEALER,
  user: { ...DEALER.user, mustChangePassword: true },
};

const category = (id: number, name: string, children: Category[] = [], parentId: number | null = null): Category =>
  ({ id, name, slug: name.toLowerCase().replace(/\W+/g, '-'), parentId, children });

export const CATEGORIES: Category[] = [
  category(1, 'Truck Accessories', [
    category(10, 'Wheels & Hubs', [category(100, 'Hub Caps', [], 10), category(101, 'Lug Nut Covers', [], 10)], 1),
    category(11, 'Lighting', [category(110, 'Light Bars', [], 11)], 1),
  ]),
  category(2, 'Motorcycle', [category(20, 'Riding Gear', [category(200, 'Riding Gloves', [], 20)], 2)]),
];

const variant = (
  id: number,
  sku: string,
  tierPrice: number,
  packQuantity: number,
  inventory: Partial<Variant['inventory']> = {},
): Variant => ({
  id,
  sku,
  variantValue: String(packQuantity),
  packQuantity,
  upc: null,
  weight: null,
  status: 'ACTIVE',
  tierPrice,
  unitPrice: Number((tierPrice / packQuantity).toFixed(2)),
  mapPrice: Number((tierPrice * 2).toFixed(2)),
  inventory: {
    availableStock: 40,
    incomingStock: 0,
    lowStock: false,
    outOfStock: false,
    updatedAt: '2026-09-10T11:05:00Z',
    ...inventory,
  },
});

const product = (id: number, spuCode: string, name: string, variants: Variant[], brand: string | null = null): Product => ({
  visibility: 'VISIBLE',
  sellable: true,
  id,
  spuCode,
  name,
  brand,
  description: `${name} — heavy-duty, chrome finish.`,
  baseWholesalePrice: variants[0].tierPrice,
  locationCode: 'C2-1',
  variantAxis: 'Pack Qty',
  attributes: { Finish: 'Chrome' },
  status: 'ACTIVE',
  categories: [{ id: 100, name: 'Hub Caps', isPrimary: true }] as Product['categories'],
  images: [],
  variants,
});

export const HUBCAP = product(1, 'H1F85N4-H50', 'Chrome Hubcap – Dome, 4-Clip', [
  variant(11, 'H1F85N4-H50-1', 9.24, 1, { availableStock: 0, outOfStock: true }),
  variant(12, 'H1F85N4-H50-2', 12.76, 2, { availableStock: 10, lowStock: true, incomingStock: 300 }),
  variant(13, 'H1F85N4-H50-6', 24.19, 6, { availableStock: 405 }),
]);

export const LIGHT_BAR = product(
  2,
  'PL-9011SS',
  '33" Chrome Stainless Tall Rear Light Panel',
  [variant(21, 'PL-9011SS-1', 65.63, 1, { availableStock: 12 })],
  'StopTech',
);

/** Nothing in stock anywhere — the row that must read as unavailable. */
export const SOLD_OUT = product(3, 'MF-200', 'Rubber Mud Flap', [
  variant(31, 'MF-200-1', 4.5, 1, { availableStock: 0, outOfStock: true }),
]);

export const ALL_PRODUCTS = [HUBCAP, LIGHT_BAR, SOLD_OUT];
