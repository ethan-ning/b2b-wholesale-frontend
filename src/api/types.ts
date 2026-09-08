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
  reservedStock: number;
  updatedAt: string;
}

export interface Variant {
  id: number;
  sku: string;
  /**
   * Display value of this SKU's differentiator, matching the SPU's `variantAxis` —
   * "M" for an apparel size, "6" for a 6-unit pack. Also the SKU code's suffix.
   */
  variantValue: string | null;
  /** Units per SKU. 1 for size-differentiated apparel; the pack size for parts. */
  packQuantity: number;
  priceAdjustment: number;
  upc: string | null;
  weight: number | null;
  status: string;
  /**
   * What the dealer pays for one of this SKU — a garment, or a whole 6-pack.
   * Equals `unitPrice * packQuantity`.
   */
  tierPrice: number;
  /** Per-unit breakdown of `tierPrice`. Equal to it when packQuantity is 1. */
  unitPrice: number;
  /**
   * Advertised price for one of this SKU, on the same basis as `tierPrice`. Always
   * stated per SKU — there is no SPU-level MAP to fall back to, because a pack SKU's
   * MAP scales with its quantity and could never be inherited.
   */
  mapPrice: number | null;
  /** Volume breaks for that tier, ascending by minQty. Empty when there are none. */
  priceBreaks: { minQty: number; price: number }[];
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
  /**
   * What differentiates the SKUs under this SPU — "Size" for apparel, "Pack Qty" for
   * parts. Used as the variant column header; null when the SPU has a single SKU.
   */
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

export interface SearchParams {
  search?: string;
  category?: number;
  priceMin?: number;
  priceMax?: number;
  sort?: string;
  page?: number;
  size?: number;
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
  /** null = applies to every SKU under the SPU; set = override for that SKU only. */
  sku: string | null;
  price: number;
  minQty: number;
}

export interface AdminProduct extends Product {
  tierPrices: TierPrice[];
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

export interface InventoryRow {
  variantId: number;
  sku: string;
  productName: string;
  spuCode: string;
  warehouseId: number;
  warehouseName: string;
  availableStock: number;
  incomingStock: number;
  reservedStock: number;
  defectiveStock: number;
  updatedAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalCustomers: number;
  activeCustomers: number;
  lowStockAlerts: number;
  outOfStockCount: number;
}
