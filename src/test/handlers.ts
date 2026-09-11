import { HttpResponse, http } from 'msw';
import { ALL_PRODUCTS, CATEGORIES, DEALER } from './fixtures';
import type { Product } from '../api/types';

const PASSWORD = 'dealer123';

/**
 * The API as the portal sees it. Intercepting at the network layer rather than mocking
 * the api/ modules keeps the axios instances and their interceptors in the test.
 *
 * Filtering is implemented rather than stubbed, so a test can assert that choosing a
 * category narrows the results instead of asserting that a request was made.
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
