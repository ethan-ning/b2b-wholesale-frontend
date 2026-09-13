// ─── Dealer types ────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children: Category[];
}

export interface ProductImage {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface Inventory {
  availableStock: number;
  incomingStock: number;
  /** In stock but running down. The API decides where that line sits, not the UI. */
  lowStock: boolean;
  outOfStock: boolean;
  updatedAt: string;
}

export interface Variant {
  id: number;
  sku: string;
  /** Value on the SPU's `variantAxis` — "M", "6". Also the SKU code's suffix. */
  variantValue: string | null;
  /** Units per SKU. 1 for apparel sizes; the pack size for parts. */
  packQuantity: number;
  upc: string | null;
  weight: number | null;
  status: string;
  /** What the dealer pays for one of this SKU. Null when nobody has priced it. */
  tierPrice: number | null;
  /** `tierPrice / packQuantity`, for comparing a pack against a single. */
  unitPrice: number | null;
  /** Advertised price for one of this SKU, same basis as `tierPrice`. */
  mapPrice: number | null;
  /** Which of the product's images stands for this SKU, or null if nobody has chosen one. */
  mainImageId: number | null;
  /**
   * What to show for this SKU in a list. Falls back to the product's first image, so a
   * search result is never a blank square — `mainImageId` is what says a choice was made.
   */
  mainImageUrl: string | null;
  inventory: Inventory;
}

export interface ProductCategory {
  id: number;
  name: string;
  isPrimary: boolean;
}

export interface Product {
  /** VISIBLE or HIDDEN — the portal's only lever. Not the ERP's on-sale state. */
  visibility: string;
  /**
   * False when some SKU still on sale has no tier price. Such a product cannot be made
   * visible — it would be offered at its base price, which for an ERP import is zero.
   */
  sellable?: boolean;
  /**
   * Why not, when `sellable` is false. The two causes are unrelated and want different
   * things done about them, so the page states which rather than guessing.
   */
  unsellableReason?: 'NOTHING_ON_SALE' | 'NO_DEFAULT_PRICE' | null;
  id: number;
  spuCode: string;
  name: string;
  brand: string | null;
  description: string | null;
  /**
   * The cheapest default price among the SKUs on sale. Derived, not set: nothing is
   * priced from it, and it exists so a search can filter and sort on one figure.
   */
  baseWholesalePrice: number;
  locationCode: string | null;
  /** What the SKUs vary along — "Size" or "Pack Qty". Titles the variant column. */
  variantAxis: string | null;
  attributes: Record<string, string>;
  status: string;
  categories: ProductCategory[];
  images: ProductImage[];
  variants: Variant[];
}

export interface PagedResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    companyName: string;
    tierId: number;
    tierName: string;
    mustChangePassword: boolean;
  };
}

// ─── Admin types ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  /** True while the password is one somebody else generated. */
  mustChangePassword?: boolean;
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminUser;
}

export interface CustomerTier {
  id: number;
  name: string;
  sortOrder: number;
  /** So much off the anchor tier's price, on everything this tier buys. */
  discountPercent: number;
  /** The tier the others are worked out from. Its discount applies to nothing. */
  anchor: boolean;
}

export interface Customer {
  id: number;
  email: string;
  name: string;
  companyName: string;
  tierId: number;
  tierName: string;
  phone: string | null;
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
  createdAt: string;
}

/**
 * What one tier pays for one SKU.
 *
 * A row exists for every SKU against every tier, whether or not anyone set a price —
 * since tiers carry a discount, every pairing has an answer. `customised` is what
 * separates a figure someone typed from the tier's standing rate.
 */
export interface TierPrice {
  tierId: number;
  tierName: string;
  sku: string;
  /** The tier every other price is worked out from. Its price is stated, not derived. */
  anchor: boolean;
  /** What this tier pays. Null when the SKU has no default price. */
  price: number | null;
  /**
   * The discount applied to the SKU's default price — what a stated price departs from.
   * Null on the anchor tier, which has nothing to depart from.
   */
  standardPrice: number | null;
  discountPercent: number;
  customised: boolean;
  /** At or above the SKU's advertised floor, leaving the dealer no margin. */
  breachesMap: boolean;
  /** Volume-break threshold. Always 1 in the MVP — see architecture doc §2.2.1. */
  minQty: number;
}

/**
 * The admin product detail response. The price book is a sibling of the product rather
 * than a field on it: tier_price is a separate table keyed by SKU, and flattening it
 * would imply the product owns rows it does not.
 */
export interface AdminProductDetail {
  product: Product;
  tierPrices: TierPrice[];
  /** Where each SKU's stock sits. The variant's own availableStock is these summed. */
  stockByWarehouse: WarehouseStock[];
}

export interface WarehouseStock {
  sku: string;
  warehouseId: number;
  warehouseName: string;
  available: number;
  /** In transit to this warehouse — Sellfox's 在途. */
  incoming: number;
  syncedAt: string;
}

/**
 * One SKU's stock, summed. The inventory screen is a flat list across the catalog, so it
 * carries the total only — see WarehouseStock for where that total comes from. Reserved
 * and defective stock are tracked upstream but never shown here.
 */
export interface SkuStock {
  variantId: number;
  sku: string;
  spuCode: string;
  productName: string;
  variantValue: string | null;
  availableStock: number;
  incomingStock: number;
  lowStock: boolean;
  outOfStock: boolean;
  lastSyncedAt: string;
}

/**
 * A category as the admin sees it: the node plus what an admin needs before acting on it.
 * `deletable` mirrors the API's own rules, so the button's state and the server agree.
 */
export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  sortOrder: number;
  /** 1 for a root. The taxonomy is capped at 3. */
  depth: number;
  /** Products filed directly under this node, not counting sub-categories. */
  productCount: number;
  /** Distinct products across this node and everything beneath it. */
  totalProductCount: number;
  /** False at the deepest allowed level. */
  canAddChild: boolean;
  /** Only sub-categories block a delete — products are unfiled, not deleted. */
  deletable: boolean;
  blockedReason: string | null;
  children: CategoryNode[];
}

/**
 * Returned once when a dealer is created or has their password reset. Only a hash is
 * stored, so this response is the sole opportunity to pass the password on.
 */
export interface CustomerCreated {
  customer: Customer;
  temporaryPassword: string;
}

export interface AdminCreated {
  admin: AdminUser;
  temporaryPassword: string;
}

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalCustomers: number;
  activeCustomers: number;
  lowStockAlerts: number;
  outOfStockCount: number;
}

// ─── Sellfox sync ────────────────────────────────────────────────────────

/**
 * A second-level Sellfox category group — "供应商甲/重卡配件" — as discovered by a sync.
 * Selecting it imports everything beneath it.
 */
export interface SellfoxCategory {
  cid: string;
  fullCid: string;
  /** First two segments of the path's names. */
  fullName: string;
  /** Commodities anywhere beneath the group. */
  commodityCount: number;
  selected: boolean;
  lastSeenAt: string | null;
}

export interface SellfoxWarehouse {
  warehouseId: number;
  name: string;
  /** 0 default, 1 domestic, 2 FBA, 3 overseas. */
  type: number | null;
  selected: boolean;
  lastSeenAt: string | null;
}

export interface SellfoxScope {
  categories: SellfoxCategory[];
  warehouses: SellfoxWarehouse[];
}

/**
 * How deep a run went. Not a job type — there is one scope and one place to set it.
 *
 * REGROUP is read-only here: past runs are still displayed, but a regroup now happens
 * only as a step inside a full sync, so nothing triggers one on its own.
 */
export type SyncMode = 'FULL' | 'INVENTORY' | 'REGROUP';

/** The modes an admin can start. */
export type TriggerableSyncMode = Exclude<SyncMode, 'REGROUP'>;

export interface SellfoxSyncRun {
  id: number;
  mode: SyncMode;
  trigger: 'SCHEDULED' | 'MANUAL' | 'SCOPE_CHANGE';
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  recordsRead: number;
  recordsWritten: number;
  recordsSkipped: number;
  errorMessage: string | null;
  summary: string | null;
}

export interface SellfoxHistory {
  runs: SellfoxSyncRun[];
  /** Whether a run is in flight. */
  running: boolean;
}

// ─── The image library ───────────────────────────────────────────────────────

export interface LibraryImage {
  id: number;
  url: string;
  filename: string;
  contentType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  /** False for a link to somewhere we do not control; deleting one removes only the row. */
  stored: boolean;
}

export interface ImageUsedBy {
  productId: number;
  spuCode: string;
  name: string;
}

export interface ImageUsage {
  image: LibraryImage;
  usedBy: ImageUsedBy[];
  /** Only an image nothing shows can be removed. Decided by the API, not counted here. */
  deletable: boolean;
}

/**
 * One page of the library. Paged by the API rather than filtered in the browser: the
 * whole library is a few hundred kilobytes and every row carries its usage, so fetching
 * the lot to show a screenful made the first paint wait on all of it.
 */
export interface ImageLibraryPage extends PagedResult<ImageUsage> {
  /** Across the whole library, not this page — it says how much can be cleared out. */
  unusedCount: number;
}
