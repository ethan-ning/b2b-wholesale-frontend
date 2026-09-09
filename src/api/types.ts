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
  /** What the dealer pays for one of this SKU — a garment, or a whole 6-pack. */
  tierPrice: number;
  /** `tierPrice / packQuantity`, for comparing a pack against a single. */
  unitPrice: number;
  /** Advertised price for one of this SKU, same basis as `tierPrice`. */
  mapPrice: number | null;
  inventory: Inventory;
}

export interface ProductCategory {
  id: number;
  name: string;
  isPrimary: boolean;
}

export interface Product {
  id: number;
  spuCode: string;
  name: string;
  brand: string | null;
  description: string | null;
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
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminUser;
}

export interface CustomerTier {
  id: number;
  name: string;
  sortOrder: number;
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

export interface TierPrice {
  tierId: number;
  tierName: string;
  sku: string;
  /** Price for one of this SKU. A pack SKU's price is the whole pack. */
  price: number;
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
}

/**
 * One SKU's stock. No warehouse dimension: stock is held per SKU in the MVP, and a
 * multi-warehouse breakdown arrives with the ERP sync. Reserved and defective stock are
 * tracked upstream but never shown here.
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

/** How deep a run went. Not a job type — there is one scope and one place to set it. */
export type SyncMode = 'FULL' | 'INVENTORY';

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
