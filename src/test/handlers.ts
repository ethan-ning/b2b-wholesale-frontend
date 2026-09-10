import { HttpResponse, http } from 'msw';
import { ALL_PRODUCTS, CATEGORIES, DEALER } from './fixtures';
import type { Product } from '../api/types';

const PASSWORD = 'dealer123';

/**
 * The API as the portal sees it.
 *
 * Intercepting at the network layer rather than mocking the api/ modules means the tests
 * exercise the axios instances, their interceptors and the real request shapes — the
 * 401-redirect interceptor and the CORS-era failure paths all live there, and a mocked
 * module would skip every one of them.
 *
 * Filtering is implemented rather than stubbed, so a test can assert that asking for a
 * category actually narrows the results instead of asserting on a request that was made.
 */
function search(url: URL): Product[] {
  const term = url.searchParams.get('search')?.toLowerCase();
  const category = url.searchParams.get('category');
  const priceMin = url.searchParams.get('priceMin');
  const priceMax = url.searchParams.get('priceMax');

  return ALL_PRODUCTS.filter((p) => {
    if (term && !`${p.name} ${p.spuCode} ${p.brand ?? ''}`.toLowerCase().includes(term)) return false;
    if (category && !p.categories.some((c) => String(c.id) === category)) return false;
    const low = Math.min(...p.variants.map((v) => v.tierPrice));
    if (priceMin && low < Number(priceMin)) return false;
    if (priceMax && low > Number(priceMax)) return false;
    return true;
  });
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (password !== PASSWORD) {
      return HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }
    return HttpResponse.json({ ...DEALER, user: { ...DEALER.user, email } });
  }),

  http.get('/api/categories', () => HttpResponse.json(CATEGORIES)),

  http.get('/api/products', ({ request }) => {
    const found = search(new URL(request.url));
    return HttpResponse.json({
      content: found,
      totalElements: found.length,
      totalPages: 1,
      page: 0,
      size: 10,
    });
  }),

  http.get('/api/products/:spuCode', ({ params }) => {
    const found = ALL_PRODUCTS.find((p) => p.spuCode === params.spuCode);
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json({ message: 'Product not found' }, { status: 404 });
  }),
];
