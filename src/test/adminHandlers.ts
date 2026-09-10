import { HttpResponse, http } from 'msw';
import {
  ADMIN_LOGIN, ALL_PRODUCTS, CATEGORY_TREE, CUSTOMERS, DASHBOARD,
  HUBCAP, PLAIN_ADMIN, STOCK_ROWS, SUPER_ADMIN, TIERS, TIER_PRICES,
} from './fixtures';
import type { AdminUser } from '../api/types';

const ADMIN_PASSWORD = 'admin123';

/**
 * The admin API, kept in its own file because it is roughly the size of the dealer one
 * and the two are never needed together.
 *
 * The roster is mutable across a test so that creating and deleting can be observed in
 * the list afterwards, rather than only in the request. `resetAdminState` puts it back.
 */
let roster: AdminUser[] = [SUPER_ADMIN, PLAIN_ADMIN];

export function resetAdminState() {
  roster = [SUPER_ADMIN, PLAIN_ADMIN];
}

const paged = <T,>(content: T[]) => ({
  content, totalElements: content.length, totalPages: 1, page: 0, size: 10,
});

export const adminHandlers = [
  http.post('/api/admin/auth/login', async ({ request }) => {
    const { password } = (await request.json()) as { password: string };
    return password === ADMIN_PASSWORD
      ? HttpResponse.json(ADMIN_LOGIN)
      : HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  }),

  http.post('/api/admin/auth/change-password', async ({ request }) => {
    const { currentPassword } = (await request.json()) as { currentPassword: string };
    return currentPassword === ADMIN_PASSWORD
      ? HttpResponse.json(SUPER_ADMIN)
      : HttpResponse.json({ message: 'Current password is incorrect' }, { status: 401 });
  }),

  http.get('/api/admin/admins', () => HttpResponse.json(roster)),

  http.post('/api/admin/admins', async ({ request }) => {
    const body = (await request.json()) as { email: string; name: string; role: AdminUser['role'] };
    if (roster.some((a) => a.email === body.email)) {
      return HttpResponse.json({ message: `An admin with email ${body.email} already exists` }, { status: 409 });
    }
    const created: AdminUser = { id: 99, email: body.email, name: body.name, role: body.role };
    roster = [...roster, created];
    return HttpResponse.json({ admin: created, temporaryPassword: 'TempPass1234' }, { status: 201 });
  }),

  http.delete('/api/admin/admins/:id', ({ params }) => {
    roster = roster.filter((a) => String(a.id) !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/admin/dashboard', () => HttpResponse.json(DASHBOARD)),
  http.get('/api/admin/tiers', () => HttpResponse.json(TIERS)),

  http.get('/api/admin/customers', ({ request }) => {
    const url = new URL(request.url);
    const term = url.searchParams.get('search')?.toLowerCase();
    const status = url.searchParams.get('status');
    return HttpResponse.json(paged(CUSTOMERS.filter((c) => {
      if (status && c.status !== status) return false;
      if (term && !`${c.name} ${c.email} ${c.companyName}`.toLowerCase().includes(term)) return false;
      return true;
    })));
  }),

  http.get('/api/admin/customers/:id', ({ params }) => {
    const found = CUSTOMERS.find((c) => String(c.id) === params.id);
    return found ? HttpResponse.json(found) : new HttpResponse(null, { status: 404 });
  }),

  http.post('/api/admin/customers/:id/reset-password', ({ params }) =>
    HttpResponse.json({
      customer: CUSTOMERS.find((c) => String(c.id) === params.id),
      temporaryPassword: 'TempPass1234',
    })),

  http.get('/api/admin/products', ({ request }) => {
    const url = new URL(request.url);
    const term = url.searchParams.get('search')?.toLowerCase();
    const visibility = url.searchParams.get('visibility');
    return HttpResponse.json(paged(ALL_PRODUCTS.filter((p) => {
      if (visibility && p.visibility !== visibility) return false;
      if (term && !`${p.name} ${p.spuCode}`.toLowerCase().includes(term)) return false;
      return true;
    })));
  }),

  http.get('/api/admin/products/:id', () =>
    HttpResponse.json({ product: HUBCAP, tierPrices: TIER_PRICES, stockByWarehouse: [] })),

  http.get('/api/admin/categories', () => HttpResponse.json(CATEGORY_TREE)),

  http.get('/api/admin/inventory', ({ request }) => {
    const url = new URL(request.url);
    const term = url.searchParams.get('search')?.toLowerCase();
    return HttpResponse.json(paged(STOCK_ROWS.filter(
      (r) => !term || `${r.sku} ${r.productName}`.toLowerCase().includes(term),
    )));
  }),
];
