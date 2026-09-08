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
