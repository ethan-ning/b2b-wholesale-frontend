import type {
  AdminUser, Category, CategoryNode, Customer, CustomerTier, DashboardStats,
  ImageUsage, LoginResponse, Product, ProductImage, SkuStock, TierPrice, Variant,
} from '../api/types';

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
  mainImage: { id: number; url: string } | null = null,
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
  mainImageId: mainImage?.id ?? null,
  mainImageUrl: mainImage?.url ?? null,
  inventory: {
    availableStock: 40,
    incomingStock: 0,
    lowStock: false,
    outOfStock: false,
    updatedAt: '2026-09-10T11:05:00Z',
    ...inventory,
  },
});

const product = (
  id: number,
  spuCode: string,
  name: string,
  variants: Variant[],
  brand: string | null = null,
  images: ProductImage[] = [],
): Product => ({
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
  images,
  variants,
});

/** Two photographs, so a gallery has something to reorder and two SKUs can differ. */
export const HUBCAP_IMAGES: ProductImage[] = [
  { id: 501, url: 'https://cdn.test/hubcap-dome.png', altText: 'Dome hubcap', sortOrder: 0 },
  { id: 502, url: 'https://cdn.test/hubcap-flat.png', altText: 'Flat hubcap', sortOrder: 1 },
];

export const HUBCAP = product(
  1,
  'H1F85N4-H50',
  'Chrome Hubcap – Dome, 4-Clip',
  [
    // Two SKUs pointing at different photos, one at none — the three cases the gallery
    // and the SKU thumbnail column each have to handle.
    variant(11, 'H1F85N4-H50-1', 9.24, 1, { availableStock: 0, outOfStock: true },
      { id: 501, url: 'https://cdn.test/hubcap-dome.png' }),
    variant(12, 'H1F85N4-H50-2', 12.76, 2, { availableStock: 10, lowStock: true, incomingStock: 300 },
      { id: 502, url: 'https://cdn.test/hubcap-flat.png' }),
    variant(13, 'H1F85N4-H50-6', 24.19, 6, { availableStock: 405 }),
  ],
  null,
  HUBCAP_IMAGES,
);

/** Exactly one photograph — the case where a gallery has nothing to page through. */
export const LIGHT_BAR = product(
  2,
  'PL-9011SS',
  '33" Chrome Stainless Tall Rear Light Panel',
  [variant(21, 'PL-9011SS-1', 65.63, 1, { availableStock: 12 })],
  'StopTech',
  [{ id: 510, url: 'https://cdn.test/light-panel.png', altText: 'Light panel', sortOrder: 0 }],
);

/**
 * Every SKU withdrawn by the supplier. Not a pricing problem, and the screen has to say
 * so: told it was a price, someone goes looking for a field that does not exist.
 */
export const ALL_DISCONTINUED: Product = {
  ...product(4, 'BR500-BLK', 'Braided Brake Line Kit', [
    { ...variant(41, 'BR500-BLK-01', 44, 1), status: 'DISCONTINUED' },
  ]),
  // Hidden, as a withdrawn product would be. The warning has to show anyway — finding
  // out only after selecting Visible and being refused is the whole problem.
  visibility: 'HIDDEN',
  sellable: false,
  unsellableReason: 'NOTHING_ON_SALE',
};

/** Nothing in stock anywhere — the row that must read as unavailable. */
export const SOLD_OUT = product(3, 'MF-200', 'Rubber Mud Flap', [
  variant(31, 'MF-200-1', 4.5, 1, { availableStock: 0, outOfStock: true }),
]);

export const ALL_PRODUCTS = [HUBCAP, LIGHT_BAR, SOLD_OUT];

// ─── Admin ────────────────────────────────────────────────────────────────

export const SUPER_ADMIN: AdminUser = {
  id: 1, email: 'owner@example.com', name: 'System Admin', role: 'SUPER_ADMIN',
};
export const PLAIN_ADMIN: AdminUser = {
  id: 2, email: 'staff@example.com', name: 'Staff Admin', role: 'ADMIN',
};

export const ADMIN_LOGIN = { token: 'admin-token', admin: SUPER_ADMIN };

export const DASHBOARD: DashboardStats = {
  totalProducts: 259, activeProducts: 257, totalCustomers: 2,
  activeCustomers: 2, lowStockAlerts: 24, outOfStockCount: 205,
};

export const TIERS: CustomerTier[] = [
  { id: 3, name: 'Default', sortOrder: 1, discountPercent: 0 },
  { id: 2, name: 'Silver', sortOrder: 2, discountPercent: 7 },
  { id: 1, name: 'Gold', sortOrder: 3, discountPercent: 18 },
];

export const CUSTOMERS: Customer[] = [
  {
    id: 1, email: 'dealer1@example.com', name: 'Gold Dealer', companyName: 'Johnson Auto Supply',
    tierId: 1, tierName: 'Gold', phone: '555-1001', status: 'ACTIVE',
    mustChangePassword: false, createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 2, email: 'dealer2@example.com', name: 'Silver Dealer', companyName: 'Reeve Trucking',
    tierId: 2, tierName: 'Silver', phone: null, status: 'DISABLED',
    mustChangePassword: true, createdAt: '2026-08-02T00:00:00Z',
  },
];

const node = (
  id: number, name: string, depth: number, children: CategoryNode[] = [], parentId: number | null = null,
): CategoryNode => ({
  id, name, slug: name.toLowerCase().replace(/\W+/g, '-'), parentId, sortOrder: id, depth,
  productCount: children.length ? 0 : 4,
  totalProductCount: children.length ? 8 : 4,
  // The taxonomy is capped at three levels; the deepest may take no child.
  canAddChild: depth < 3,
  deletable: children.length === 0,
  blockedReason: children.length ? 'Has sub-categories' : null,
  children,
});

export const CATEGORY_TREE: CategoryNode[] = [
  node(1, 'Truck Accessories', 1, [
    node(10, 'Wheels & Hubs', 2, [node(100, 'Hub Caps', 3, [], 10)], 1),
  ]),
  node(2, 'Motorcycle', 1, [], null),
];

export const STOCK_ROWS: SkuStock[] = [
  {
    variantId: 11, sku: 'H1F85N4-H50-1', spuCode: 'H1F85N4-H50', productName: 'Chrome Hubcap – Dome, 4-Clip',
    variantValue: '1', availableStock: 0, incomingStock: 0, lowStock: false, outOfStock: true,
    lastSyncedAt: '2026-09-10T11:05:00Z',
  },
  {
    variantId: 12, sku: 'H1F85N4-H50-2', spuCode: 'H1F85N4-H50', productName: 'Chrome Hubcap – Dome, 4-Clip',
    variantValue: '2', availableStock: 10, incomingStock: 300, lowStock: true, outOfStock: false,
    lastSyncedAt: '2026-09-10T11:05:00Z',
  },
];

/**
 * The price book as the API sends it: a row for every SKU against every tier, priced by
 * the tier's standing discount unless somebody set a figure.
 *
 * One row is deliberately customised, so tests can tell a typed price from a standing
 * rate — the distinction the whole screen turns on.
 */
const CUSTOMISED = new Map([['H1F85N4-H50-1:1', 7.0]]);

export const TIER_PRICES: TierPrice[] = HUBCAP.variants.flatMap((v) =>
  TIERS.map((tier): TierPrice => {
    // The base price is what the SKU lists at, whatever the pack holds.
    const standardPrice = Number((HUBCAP.baseWholesalePrice * (1 - tier.discountPercent / 100)).toFixed(2));
    const override = CUSTOMISED.get(`${v.sku}:${tier.id}`);
    const price = override ?? standardPrice;
    return {
      sku: v.sku,
      tierId: tier.id,
      tierName: tier.name,
      price,
      standardPrice,
      discountPercent: tier.discountPercent,
      customised: override !== undefined,
      breachesMap: v.mapPrice !== null && price >= v.mapPrice,
      minQty: 1,
    };
  }),
);

/**
 * The image library. Two photographs the hubcap shows, and one nothing does — the only
 * row the library screen will let anyone delete.
 */
export const IMAGE_LIBRARY: ImageUsage[] = [
  {
    image: {
      id: 501, url: 'https://cdn.test/hubcap-dome.png', filename: 'hubcap-dome.png',
      contentType: 'image/png', bytes: 184320, width: 1200, height: 1200,
      altText: 'Dome hubcap', stored: true,
    },
    usedBy: [{ productId: 1, spuCode: 'H1F85N4-H50', name: 'Chrome Hubcap – Dome, 4-Clip' }],
    deletable: false,
  },
  {
    image: {
      id: 502, url: 'https://cdn.test/hubcap-flat.png', filename: 'hubcap-flat.png',
      contentType: 'image/png', bytes: 96000, width: 900, height: 900,
      altText: 'Flat hubcap', stored: true,
    },
    usedBy: [{ productId: 1, spuCode: 'H1F85N4-H50', name: 'Chrome Hubcap – Dome, 4-Clip' }],
    deletable: false,
  },
  {
    image: {
      id: 503, url: 'https://cdn.test/spare-bracket.jpg', filename: 'spare-bracket.jpg',
      contentType: 'image/jpeg', bytes: 2200, width: 400, height: 300,
      altText: null, stored: true,
    },
    usedBy: [],
    deletable: true,
  },
];
