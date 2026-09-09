import { authClient, dealerClient } from './http';
import type { Category, LoginResponse, PagedResult, Product } from './types';

/**
 * Every dealer-facing endpoint the app calls, in one place. Pages call these instead of
 * axios directly, so a change to a path, param name or response shape lands here only.
 */

export interface ProductQuery {
  search?: string;
  category?: number | null;
  priceMin?: number;
  priceMax?: number;
  sort?: string;
  page?: number;
  size?: number;
}

export const PAGE_SIZE = 10;

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await authClient.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await dealerClient.get<Category[]>('/categories');
  return data;
}

export async function searchProducts(query: ProductQuery): Promise<PagedResult<Product>> {
  const params: Record<string, string> = {
    page: String(query.page ?? 0),
    size: String(query.size ?? PAGE_SIZE),
    sort: query.sort ?? 'relevance',
  };
  if (query.search) params.search = query.search;
  if (query.category) params.category = String(query.category);
  if (query.priceMin !== undefined) params.priceMin = String(query.priceMin);
  if (query.priceMax !== undefined) params.priceMax = String(query.priceMax);

  const { data } = await dealerClient.get<PagedResult<Product>>('/products', { params });
  return data;
}

export async function fetchProduct(spuCode: string): Promise<Product> {
  const { data } = await dealerClient.get<Product>(`/products/${spuCode}`);
  return data;
}
