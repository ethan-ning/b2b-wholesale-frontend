import { adminClient, authClient } from './http';
import { DEFAULT_PAGE_SIZE } from '../components/listPagination';
import type {
  AdminCreated, AdminLoginResponse, AdminProductDetail, AdminUser, Category, CategoryNode, Customer, CustomerCreated,
  CustomerTier, DashboardStats, ImageLibraryPage, LibraryImage, PagedResult, Product, SkuStock,
  SellfoxHistory, SellfoxScope, SellfoxSyncRun, TriggerableSyncMode,
} from './types';

/** Every admin endpoint the app calls. See catalog.ts for the dealer side. */

export const PAGE_SIZE = 10;

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AdminLoginResponse> {
  const { data } = await authClient.post<AdminLoginResponse>('/admin/auth/login', { email, password });
  return data;
}

/**
 * Changing your own password. Returns a full session, because whoever is finishing a
 * forced change arrived holding a token that reaches only this endpoint.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<AdminLoginResponse> {
  const { data } = await adminClient.post<AdminLoginResponse>('/admin/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return data;
}

// ─── Admin accounts ──────────────────────────────────────────────────────────
export async function fetchAdmins(): Promise<AdminUser[]> {
  const { data } = await adminClient.get<AdminUser[]>('/admin/admins');
  return data;
}

/** Super admin only. The temporary password comes back once and is never stored. */
export async function createAdmin(input: {
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
}): Promise<AdminCreated> {
  const { data } = await adminClient.post<AdminCreated>('/admin/admins', input);
  return data;
}

/** Super admin only. Issues a new generated password and forces a change on next sign-in. */
export async function resetAdminPassword(id: number): Promise<AdminCreated> {
  const { data } = await adminClient.post<AdminCreated>(`/admin/admins/${id}/reset-password`);
  return data;
}

/** Super admin only. */
export async function deleteAdmin(id: number): Promise<void> {
  await adminClient.delete(`/admin/admins/${id}`);
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export async function fetchDashboard(): Promise<DashboardStats> {
  const { data } = await adminClient.get<DashboardStats>('/admin/dashboard');
  return data;
}

// ─── Products ────────────────────────────────────────────────────────────────
export interface AdminProductQuery {
  search?: string;
  /** VISIBLE or HIDDEN. */
  visibility?: string;
  /** spuCode (default), name, brand or price. */
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export async function fetchProducts(query: AdminProductQuery): Promise<PagedResult<Product>> {
  const params: Record<string, string> = {
    page: String(query.page ?? 0),
    size: String(query.size ?? PAGE_SIZE),
  };
  if (query.search) params.search = query.search;
  if (query.visibility) params.visibility = query.visibility;
  if (query.sort) params.sort = query.sort;
  if (query.direction) params.direction = query.direction;

  const { data } = await adminClient.get<PagedResult<Product>>('/admin/products', { params });
  return data;
}

export async function fetchProduct(id: string | number): Promise<AdminProductDetail> {
  const { data } = await adminClient.get<AdminProductDetail>(`/admin/products/${id}`);
  return data;
}

/**
 * Portal-owned fields only. The API has no field for name, brand, description, SPU code
 * or variant axis — the ERP owns those, so they cannot be sent rather than being rejected
 * (architecture doc §3.7.7).
 */
export interface ProductUpdate {
  locationCode: string | null;
  /** VISIBLE or HIDDEN. */
  visibility: string;
  attributes: Record<string, string>;
  categoryIds: number[];
  primaryCategoryId: number | null;
  /** variantId -> MAP. An absent entry means "leave it", not "clear it". */
  variantMapPrices: Record<number, number | null>;
  tierPrices: { sku: string; tierId: number; price: number; minQty: number }[];
}

export async function updateProduct(id: string | number, update: ProductUpdate): Promise<AdminProductDetail> {
  const { data } = await adminClient.put<AdminProductDetail>(`/admin/products/${id}`, update);
  return data;
}

/**
 * Hides a product from dealers, or brings it back. There is no delete: products come from
 * the ERP, so a portal delete would be undone by the next sync and would take the pricing
 * attached to it.
 */
export async function setProductActive(id: number, active: boolean): Promise<AdminProductDetail> {
  const action = active ? 'activate' : 'deactivate';
  const { data } = await adminClient.post<AdminProductDetail>(`/admin/products/${id}/${action}`);
  return data;
}

// ─── Categories ──────────────────────────────────────────────────────────────
export async function fetchCategories(): Promise<CategoryNode[]> {
  const { data } = await adminClient.get<CategoryNode[]>('/admin/categories');
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

export interface CreateCustomer {
  email: string;
  name: string;
  companyName: string;
  tierId: number;
  phone?: string | null;
}

/** Returns the generated password — shown once, never retrievable afterwards. */
export async function createCustomer(values: CreateCustomer): Promise<CustomerCreated> {
  const { data } = await adminClient.post<CustomerCreated>('/admin/customers', values);
  return data;
}

/**
 * The whole profile, not a patch: an update states what the dealer's details now are.
 * Email and password are absent — changing an email is an identity change with its own
 * use case, and an admin never sets a password, only resets it.
 */
export interface UpdateCustomer {
  name: string;
  companyName: string;
  tierId: number;
  phone?: string | null;
  status?: string;
}

export async function resetCustomerPassword(id: number): Promise<CustomerCreated> {
  const { data } = await adminClient.post<CustomerCreated>(`/admin/customers/${id}/reset-password`);
  return data;
}

export async function updateCustomer(id: string | number, values: UpdateCustomer): Promise<Customer> {
  const { data } = await adminClient.put<Customer>(`/admin/customers/${id}`, values);
  return data;
}

/** Retunes a tier. Every SKU nobody has quoted separately moves with it. */
export async function setTierDiscount(tierId: number, discountPercent: number): Promise<CustomerTier> {
  const { data } = await adminClient.put<CustomerTier>(`/admin/tiers/${tierId}/discount`, { discountPercent });
  return data;
}

export async function fetchTiers(): Promise<CustomerTier[]> {
  const { data } = await adminClient.get<CustomerTier[]>('/admin/tiers');
  return data;
}

// ─── Inventory ───────────────────────────────────────────────────────────────
// Read-only: stock is Sellfox's, and an override here would be reverted by the next
// sync (architecture doc §3.7.7).
export interface StockQuery {
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  size?: number;
}

export async function fetchInventory(query: StockQuery): Promise<PagedResult<SkuStock>> {
  const params: Record<string, string> = {
    page: String(query.page ?? 0),
    size: String(query.size ?? 20),
  };
  if (query.search) params.search = query.search;
  if (query.lowStockOnly) params.lowStock = 'true';

  const { data } = await adminClient.get<PagedResult<SkuStock>>('/admin/inventory', { params });
  return data;
}


// ─── Sellfox sync ────────────────────────────────────────────────────────

export async function fetchSellfoxScope(): Promise<SellfoxScope> {
  const { data } = await adminClient.get<SellfoxScope>('/admin/sellfox/scope');
  return data;
}

/**
 * Replaces the whole scope and starts the full sync that enacts it. Not optional:
 * narrowing the scope leaves products in the catalog that should no longer be there,
 * and that run is what deactivates them.
 */
export async function setScope(cids: string[], warehouseIds: number[]): Promise<SellfoxSyncRun> {
  const { data } = await adminClient.put<SellfoxSyncRun>('/admin/sellfox/scope', {
    cids,
    warehouseIds,
  });
  return data;
}

export async function fetchSyncRuns(limit = 25): Promise<SellfoxHistory> {
  const { data } = await adminClient.get<SellfoxHistory>('/admin/sellfox/runs', {
    params: { limit },
  });
  return data;
}

/**
 * Starts a run and returns its record, already RUNNING. The outcome arrives through
 * fetchSyncRuns — a run pages every commodity Sellfox holds and takes a couple of
 * minutes, far longer than a request should be held open.
 */
export async function triggerSync(mode: TriggerableSyncMode = 'FULL'): Promise<SellfoxSyncRun> {
  const { data } = await adminClient.post<SellfoxSyncRun>('/admin/sellfox/runs', null, {
    params: mode === 'FULL' ? undefined : { mode: mode.toLowerCase() },
  });
  return data;
}

// ─── Images ──────────────────────────────────────────────────────────────────

export interface ImageQuery {
  search?: string;
  unusedOnly?: boolean;
  page?: number;
  size?: number;
}

/** One page. Searching and the unused filter are the API's job, so they reach every row. */
export async function fetchImageLibrary(query: ImageQuery = {}): Promise<ImageLibraryPage> {
  const { data } = await adminClient.get<ImageLibraryPage>('/admin/images', {
    params: {
      page: query.page ?? 0,
      size: query.size ?? DEFAULT_PAGE_SIZE,
      search: query.search?.trim() || undefined,
      unusedOnly: query.unusedOnly || undefined,
    },
  });
  return data;
}

/**
 * Sent as multipart, so the browser sets its own boundary — the JSON content type the
 * client defaults to would make the upload unreadable at the other end.
 */
export async function uploadImage(file: File): Promise<LibraryImage> {
  const body = new FormData();
  body.append('file', file);
  const { data } = await adminClient.post<LibraryImage>('/admin/images', body, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

export async function deleteImage(id: number): Promise<void> {
  await adminClient.delete(`/admin/images/${id}`);
}

export async function attachImage(productId: number, imageId: number): Promise<void> {
  await adminClient.post(`/admin/products/${productId}/images/${imageId}`);
}

export async function detachImage(productId: number, imageId: number): Promise<void> {
  await adminClient.delete(`/admin/products/${productId}/images/${imageId}`);
}

/** The whole order at once: a gallery is arranged, not nudged one place at a time. */
export async function reorderImages(productId: number, imageIds: number[]): Promise<void> {
  await adminClient.put(`/admin/products/${productId}/images/order`, imageIds);
}

/** Null clears it. A SKU may only point at an image its own product shows. */
export async function setMainImage(
  productId: number,
  variantId: number,
  imageId: number | null,
): Promise<void> {
  await adminClient.put(`/admin/products/${productId}/variants/${variantId}/main-image`, { imageId });
}
