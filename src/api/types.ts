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
  packQuantity: number;
  priceAdjustment: number;
  upc: string | null;
  weight: number | null;
  status: string;
  tierPrice: number;
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
  mapPrice: number | null;
  locationCode: string | null;
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
