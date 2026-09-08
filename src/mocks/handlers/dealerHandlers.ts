import { http, HttpResponse } from 'msw';
import { categories } from '../data/categories';
import { users } from '../data/users';
import { getProducts } from '../data/products';
import type { Product } from '../../api/types';

function getTierId(request: Request): number {
  const auth = request.headers.get('Authorization') ?? '';
  try {
    const payload = JSON.parse(atob(auth.replace('Bearer ', '').split('.')[1]));
    return payload.tierId ?? 1;
  } catch {
    return 1;
  }
}

function makeFakeJwt(user: (typeof users)[0]): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: user.email,
    userId: user.id,
    tierId: user.tierId,
    exp: Math.floor(Date.now() / 1000) + 86400,
  }));
  return `${header}.${payload}.mock-signature`;
}

function matchesSearch(product: Product, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    product.name.toLowerCase().includes(q) ||
    product.spuCode.toLowerCase().includes(q) ||
    (product.brand ?? '').toLowerCase().includes(q) ||
    (product.description ?? '').toLowerCase().includes(q) ||
    product.variants.some((v) => v.sku.toLowerCase().includes(q))
  );
}

function matchesCategory(product: Product, categoryId: number): boolean {
  if (!categoryId) return true;
  return product.categories.some((c) => c.id === categoryId);
}

// Filter and sort on what the dealer is actually shown — their resolved tier price —
// not baseWholesalePrice, which is list and identical for every tier.
function lowestPrice(product: Product): number {
  return Math.min(...product.variants.map((v) => v.tierPrice));
}

function matchesPrice(product: Product, priceMin?: number, priceMax?: number): boolean {
  // An SPU matches if any of its SKUs falls in the range.
  return product.variants.some(
    (v) => (priceMin === undefined || v.tierPrice >= priceMin) &&
           (priceMax === undefined || v.tierPrice <= priceMax)
  );
}

function sortProducts(products: Product[], sort: string): Product[] {
  switch (sort) {
    case 'price_asc':
      return [...products].sort((a, b) => lowestPrice(a) - lowestPrice(b));
    case 'price_desc':
      return [...products].sort((a, b) => lowestPrice(b) - lowestPrice(a));
    case 'name_asc':
      return [...products].sort((a, b) => a.name.localeCompare(b.name));
    default:
      return products;
  }
}

export const dealerHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      return HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }
    return HttpResponse.json({
      token: makeFakeJwt(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyName: user.companyName,
        tierId: user.tierId,
        tierName: user.tierName,
        mustChangePassword: user.mustChangePassword,
      },
    });
  }),

  http.get('/api/categories', () => {
    return HttpResponse.json(categories);
  }),

  http.get('/api/products', ({ request }) => {
    const tierId = getTierId(request);
    const allProducts = getProducts(tierId);
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? '';
    const categoryId = Number(url.searchParams.get('category') ?? 0);
    const priceMin = url.searchParams.get('priceMin') ? Number(url.searchParams.get('priceMin')) : undefined;
    const priceMax = url.searchParams.get('priceMax') ? Number(url.searchParams.get('priceMax')) : undefined;
    const sort = url.searchParams.get('sort') ?? 'relevance';
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 10);

    let filtered = allProducts
      .filter((p) => matchesSearch(p, search))
      .filter((p) => matchesCategory(p, categoryId))
      .filter((p) => matchesPrice(p, priceMin, priceMax));

    filtered = sortProducts(filtered, sort);

    const totalElements = filtered.length;
    const content = filtered.slice(page * size, page * size + size);

    return HttpResponse.json({
      content,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
      page,
      size,
    });
  }),

  http.get('/api/products/:spuCode', ({ request, params }) => {
    const tierId = getTierId(request);
    const allProducts = getProducts(tierId);
    const product = allProducts.find((p) => p.spuCode === params.spuCode);
    if (!product) {
      return HttpResponse.json({ message: 'Product not found' }, { status: 404 });
    }
    return HttpResponse.json(product);
  }),
];
