import { http, HttpResponse } from 'msw';
import { admins, tiers, warehouses, mutableCustomers, setMutableCustomers, makeAdminJwt } from '../data/admin';
import { categories as baseCategories } from '../data/categories';
import { getProducts } from '../data/products';
import { getTierPriceRowsForSkus } from '../data/tierPrices';
import type { Category, Customer, AdminProduct } from '../../api/types';

// ─── Mutable in-memory state ─────────────────────────────────────────────────
let mutableCategories: Category[] = JSON.parse(JSON.stringify(baseCategories));
let nextCategoryId = 100;
let nextCustomerId = 100;

const baseProducts = getProducts(1);
let mutableProducts: AdminProduct[] = baseProducts.map((p) => ({
  ...p,
  // Ordered by the SPU's variant order, not the SKU string — sizes are not lexical,
  // so sorting by code lists a jacket run as L, M, S, XL.
  tierPrices: getTierPriceRowsForSkus(p.variants.map((v) => v.sku))
    .map((r) => ({
      tierId: r.tierId,
      tierName: tiers.find((t) => t.id === r.tierId)?.name ?? `Tier ${r.tierId}`,
      sku: r.sku,
      price: r.price,
      minQty: r.minQty,
    }))
    .sort((a, b) => {
      const order = (sku: string) => p.variants.findIndex((v) => v.sku === sku);
      return order(a.sku) - order(b.sku) || a.tierId - b.tierId || a.minQty - b.minQty;
    }),
}));
// ─── Helpers ─────────────────────────────────────────────────────────────────
function requireAdmin(request: Request): boolean {
  const auth = request.headers.get('Authorization') ?? '';
  return auth.includes('admin-mock-signature');
}

function flattenCategories(cats: Category[]): Category[] {
  const result: Category[] = [];
  function walk(list: Category[]) {
    for (const c of list) {
      result.push(c);
      if (c.children.length) walk(c.children);
    }
  }
  walk(cats);
  return result;
}

function buildInventoryRows() {
  const rows = [];
  for (const p of mutableProducts) {
    for (const v of p.variants) {
      for (const wh of warehouses) {
        const seed = (v.id * 7 + wh.id * 13) % 40;
        rows.push({
          variantId: v.id,
          sku: v.sku,
          productName: p.name,
          spuCode: p.spuCode,
          warehouseId: wh.id,
          warehouseName: wh.name,
          availableStock: seed,
          incomingStock: seed % 3 === 0 ? seed + 5 : 0,
          reservedStock: Math.floor(seed / 5),
          defectiveStock: seed % 7 === 0 ? 2 : 0,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
  return rows;
}

export const adminHandlers = [
  // POST /api/admin/auth/login
  http.post('/api/admin/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const admin = admins.find((a) => a.email === email && a.password === password);
    if (!admin) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json({
      token: makeAdminJwt(admin),
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  }),

  // GET /api/admin/dashboard
  http.get('/api/admin/dashboard', ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const allInventory = buildInventoryRows();
    const lowStock = allInventory.filter((r) => r.availableStock > 0 && r.availableStock < 5).length;
    const outOfStock = allInventory.filter((r) => r.availableStock <= 0).length;
    return HttpResponse.json({
      totalProducts: mutableProducts.length,
      activeProducts: mutableProducts.filter((p) => p.status === 'ACTIVE').length,
      totalCustomers: mutableCustomers.length,
      activeCustomers: mutableCustomers.filter((c) => c.status === 'ACTIVE').length,
      lowStockAlerts: lowStock,
      outOfStockCount: outOfStock,
    });
  }),

  // GET /api/admin/products
  http.get('/api/admin/products', ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const status = url.searchParams.get('status') ?? '';
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 10);

    let filtered = mutableProducts.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search) ||
        p.spuCode.toLowerCase().includes(search);
      const matchStatus = !status || p.status === status;
      return matchSearch && matchStatus;
    });

    return HttpResponse.json({
      content: filtered.slice(page * size, page * size + size),
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      page,
      size,
    });
  }),

  // GET /api/admin/products/:id
  http.get('/api/admin/products/:id', ({ request, params }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const product = mutableProducts.find((p) => p.id === Number(params.id));
    if (!product) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(product);
  }),

  // PUT /api/admin/products/:id — portal-owned fields only (doc §3.7.7). Sellfox-owned
  // fields are rejected, not ignored, so a bad client fails loudly.
  http.put('/api/admin/products/:id', async ({ request, params }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = (await request.json()) as Partial<AdminProduct>;
    const idx = mutableProducts.findIndex((p) => p.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });

    const sellfoxOwned = ['name', 'brand', 'description', 'spuCode', 'variantAxis'];
    const offending = sellfoxOwned.filter((f) => f in body);
    if (offending.length) {
      return HttpResponse.json(
        { message: `Synced from Sellfox, not editable here: ${offending.join(', ')}` },
        { status: 400 }
      );
    }

    // Only mapPrice is ours — merge it in rather than taking the client's variant.
    const incomingMaps = new Map((body.variants ?? []).map((v) => [v.id, v.mapPrice]));
    const { variants: _ignored, ...rest } = body;
    mutableProducts = mutableProducts.map((p, i) =>
      i === idx
        ? {
            ...p,
            ...rest,
            variants: p.variants.map((v) =>
              incomingMaps.has(v.id) ? { ...v, mapPrice: incomingMaps.get(v.id) ?? null } : v
            ),
          }
        : p
    );
    return HttpResponse.json(mutableProducts[idx]);
  }),

  // DELETE /api/admin/products/:id
  http.delete('/api/admin/products/:id', ({ request, params }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    mutableProducts = mutableProducts.filter((p) => p.id !== Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/admin/categories
  http.get('/api/admin/categories', ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json(mutableCategories);
  }),

  // POST /api/admin/categories
  http.post('/api/admin/categories', async ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { name, parentId } = (await request.json()) as { name: string; parentId: number | null };
    const newCat: Category = {
      id: nextCategoryId++,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      parentId,
      children: [],
    };
    if (parentId === null) {
      mutableCategories = [...mutableCategories, newCat];
    } else {
      const flat = flattenCategories(mutableCategories);
      const parent = flat.find((c) => c.id === parentId);
      if (parent) parent.children = [...parent.children, newCat];
    }
    return HttpResponse.json(newCat, { status: 201 });
  }),

  // PUT /api/admin/categories/:id
  http.put('/api/admin/categories/:id', async ({ request, params }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { name } = (await request.json()) as { name: string };
    const flat = flattenCategories(mutableCategories);
    const cat = flat.find((c) => c.id === Number(params.id));
    if (!cat) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    cat.name = name;
    cat.slug = name.toLowerCase().replace(/\s+/g, '-');
    return HttpResponse.json(cat);
  }),

  // DELETE /api/admin/categories/:id
  http.delete('/api/admin/categories/:id', ({ request, params }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const id = Number(params.id);
    function removeFromList(list: Category[]): Category[] {
      return list
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, children: removeFromList(c.children) }));
    }
    mutableCategories = removeFromList(mutableCategories);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/admin/customers
  http.get('/api/admin/customers', ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const status = url.searchParams.get('status') ?? '';
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 10);

    let filtered = mutableCustomers.filter((c) => {
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.companyName.toLowerCase().includes(search);
      const matchStatus = !status || c.status === status;
      return matchSearch && matchStatus;
    });

    return HttpResponse.json({
      content: filtered.slice(page * size, page * size + size),
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      page,
      size,
    });
  }),

  // GET /api/admin/customers/:id
  http.get('/api/admin/customers/:id', ({ request, params }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const c = mutableCustomers.find((c) => c.id === Number(params.id));
    if (!c) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(c);
  }),

  // POST /api/admin/customers
  http.post('/api/admin/customers', async ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = (await request.json()) as Partial<Customer>;
    const tier = tiers.find((t) => t.id === body.tierId) ?? tiers[0];
    const newCustomer: Customer = {
      id: nextCustomerId++,
      email: body.email ?? '',
      name: body.name ?? '',
      companyName: body.companyName ?? '',
      tierId: tier.id,
      tierName: tier.name,
      phone: body.phone ?? null,
      status: 'ACTIVE',
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    setMutableCustomers([...mutableCustomers, newCustomer]);
    return HttpResponse.json(newCustomer, { status: 201 });
  }),

  // PUT /api/admin/customers/:id
  http.put('/api/admin/customers/:id', async ({ request, params }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = (await request.json()) as Partial<Customer>;
    const idx = mutableCustomers.findIndex((c) => c.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const tier = body.tierId ? (tiers.find((t) => t.id === body.tierId) ?? tiers[0]) : null;
    const updated = {
      ...mutableCustomers[idx],
      ...body,
      ...(tier ? { tierName: tier.name } : {}),
    };
    setMutableCustomers(mutableCustomers.map((c, i) => (i === idx ? updated : c)));
    return HttpResponse.json(updated);
  }),

  // GET /api/admin/tiers
  http.get('/api/admin/tiers', ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json(tiers);
  }),

  // GET /api/admin/warehouses
  http.get('/api/admin/warehouses', ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json(warehouses);
  }),

  // GET /api/admin/inventory
  http.get('/api/admin/inventory', ({ request }) => {
    if (!requireAdmin(request)) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const warehouseId = url.searchParams.get('warehouse') ? Number(url.searchParams.get('warehouse')) : null;
    const lowStock = url.searchParams.get('lowStock') === 'true';
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    let rows = buildInventoryRows();
    if (warehouseId) rows = rows.filter((r) => r.warehouseId === warehouseId);
    if (lowStock) rows = rows.filter((r) => r.availableStock < 5);

    return HttpResponse.json({
      content: rows.slice(page * size, page * size + size),
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / size),
      page,
      size,
    });
  }),
];
