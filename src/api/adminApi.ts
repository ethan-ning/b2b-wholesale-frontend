import { adminClient, dealerClient } from './http';
import type {
  AdminLoginResponse, AdminProduct, Category, Customer, CustomerTier,
  DashboardStats, InventoryRow, PagedResult, Warehouse,
} from './types';

/** Every admin endpoint the app calls. See catalog.ts for the dealer side. */

export const PAGE_SIZE = 10;

// ─── Auth ────────────────────────────────────────────────────────────────────
// Login goes through the dealer client because no admin token exists yet.
export async function login(email: string, password: string): Promise<AdminLoginResponse> {
  const { data } = await dealerClient.post<AdminLoginResponse>('/admin/auth/login', { email, password });
  return data;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export async function fetchDashboard(): Promise<DashboardStats> {
  const { data } = await adminClient.get<DashboardStats>('/admin/dashboard');
  return data;
}

// ─── Products ────────────────────────────────────────────────────────────────
export interface AdminProductQuery {
  search?: string;
  status?: string;
  page?: number;
  size?: number;
}

export async function fetchProducts(query: AdminProductQuery): Promise<PagedResult<AdminProduct>> {
  const params: Record<string, string> = {
    page: String(query.page ?? 0),
    size: String(query.size ?? PAGE_SIZE),
  };
  if (query.search) params.search = query.search;
  if (query.status) params.status = query.status;

  const { data } = await adminClient.get<PagedResult<AdminProduct>>('/admin/products', { params });
  return data;
}

export async function fetchProduct(id: string | number): Promise<AdminProduct> {
  const { data } = await adminClient.get<AdminProduct>(`/admin/products/${id}`);
  return data;
}

/**
 * Portal-owned fields only — the API rejects Sellfox-owned ones (architecture doc
 * §3.7.7), so the payload type is the contract rather than a partial product.
 */
export interface ProductUpdate {
  baseWholesalePrice: number;
  locationCode: string;
  status: string;
  attributes: Record<string, string>;
  images: { url: string; altText: string | null; sortOrder: number }[];
  categories: { id: number; name: string; isPrimary: boolean }[];
  variants: { id: number; mapPrice: number | null }[];
  tierPrices: AdminProduct['tierPrices'];
}

export async function updateProduct(id: string | number, update: ProductUpdate): Promise<AdminProduct> {
  const { data } = await adminClient.put<AdminProduct>(`/admin/products/${id}`, update);
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  await adminClient.delete(`/admin/products/${id}`);
}

// ─── Categories ──────────────────────────────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  const { data } = await adminClient.get<Category[]>('/admin/categories');
  return data;
}

export async function createCategory(name: string, parentId: number | null): Promise<Category> {
  const { data } = await adminClient.post<Category>('/admin/categories', { name, parentId });
  return data;
}

export async function renameCategory(id: number, name: string): Promise<void> {
  await adminClient.put(`/admin/categories/${id}`, { name });
}

export async function deleteCategory(id: number): Promise<void> {
  await adminClient.delete(`/admin/categories/${id}`);
}

// ─── Customers ───────────────────────────────────────────────────────────────
export interface CustomerQuery {
  search?: string;
  status?: string;
  page?: number;
  size?: number;
}

export async function fetchCustomers(query: CustomerQuery): Promise<PagedResult<Customer>> {
  const params: Record<string, string> = {
    page: String(query.page ?? 0),
    size: String(query.size ?? PAGE_SIZE),
  };
  if (query.search) params.search = query.search;
  if (query.status) params.status = query.status;

  const { data } = await adminClient.get<PagedResult<Customer>>('/admin/customers', { params });
  return data;
}

export async function fetchCustomer(id: string | number): Promise<Customer> {
  const { data } = await adminClient.get<Customer>(`/admin/customers/${id}`);
  return data;
}

export async function createCustomer(values: Partial<Customer>): Promise<Customer> {
  const { data } = await adminClient.post<Customer>('/admin/customers', values);
  return data;
}

export async function updateCustomer(id: string | number, values: Partial<Customer>): Promise<Customer> {
  const { data } = await adminClient.put<Customer>(`/admin/customers/${id}`, values);
  return data;
}

export async function fetchTiers(): Promise<CustomerTier[]> {
  const { data } = await adminClient.get<CustomerTier[]>('/admin/tiers');
  return data;
}

// ─── Inventory ───────────────────────────────────────────────────────────────
// Read-only: stock is Sellfox's, and an override here would be reverted by the next
// sync (architecture doc §3.7.7).
export interface InventoryQuery {
  warehouseId?: number | null;
  lowStockOnly?: boolean;
  page?: number;
  size?: number;
}

export async function fetchInventory(query: InventoryQuery): Promise<PagedResult<InventoryRow>> {
  const params: Record<string, string> = {
    page: String(query.page ?? 0),
    size: String(query.size ?? 20),
  };
  if (query.warehouseId) params.warehouse = String(query.warehouseId);
  if (query.lowStockOnly) params.lowStock = 'true';

  const { data } = await adminClient.get<PagedResult<InventoryRow>>('/admin/inventory', { params });
  return data;
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const { data } = await adminClient.get<Warehouse[]>('/admin/warehouses');
  return data;
}
