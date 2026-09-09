# B2B Wholesale Portal

A dealer-facing catalog and order-inquiry portal plus an admin management panel for a B2B wholesale business. No backend required during development — all API calls are intercepted by [MSW (Mock Service Worker)](https://mswjs.io/) with realistic mock data.

## Tech stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| UI | Ant Design 6 |
| Routing | React Router v7 |
| State | Zustand 5 |
| HTTP | Axios (separate dealer / admin instances) |
| Mocking | MSW 2 (browser mode) |

---

## Getting started

```bash
# Install dependencies
npm install

# Start dev server (MSW auto-starts in dev mode)
npm run dev
```

Open http://localhost:5173.

---

## Build

```bash
npm run build       # type-check + production bundle → dist/
npm run preview     # serve the production build locally
```

---

## Accounts

### Dealer accounts

| Email | Password | Tier |
|---|---|---|
| dealer1@example.com | password | Gold (best pricing — 10–16% under Silver depending on the product) |
| dealer2@example.com | password | Silver |

### Admin account

| Email | Password | Role |
|---|---|---|
| admin@example.com | admin123 | Super Admin |

---

## Flow 1 — Dealer portal

Entry point: http://localhost:5173/login

### Step-by-step

1. **Login** — enter dealer credentials → redirected to the search home page.
2. **Search home** — centered search bar with welcome message. Try searching `jacket`, `exhaust`, or `PL001-BLK`.
3. **Search results** (`/search?q=…`) — each result is an inline-expanded card showing:
   - Product image, name, brand, location code, attributes
   - Tier-resolved price range for the SPU, labelled "your price", with the MAP range beneath it
   - Per-SKU price and MAP side by side in the inline SKU table
   - Per-SKU stock badges: green ≥ 10, orange 1–9, red 0
   - Incoming stock shown in blue
4. **Active filters** — a removable tag per active filter (search term, category, price range) sits above the results, with a **Clear all** button beside them. The no-results empty state carries the same action, spelled out as **Clear all and show every product**. Clearing the header search box (×) or submitting it empty also lands on the full catalog.
5. **Sidebar filters**:
   - Category tree — click any leaf node to filter; click "All categories" to reset
   - Price range — enter min/max, click Apply; Clear resets both fields
   - Submitting a **new search term clears both sidebar filters**, since stale ones silently narrow the results. The reverse doesn't apply — applying a filter refines the current search and keeps the term. Clearing the term isn't a new search, so it leaves the sidebar alone.
6. **Sort** — dropdown in top-right of results: Relevance, Price ↑, Price ↓, Name A–Z
7. **Product detail** (`/products/:spuCode`) — full image gallery, attributes table, complete SKU table with MAP and UPC columns, CSV export button, last-synced timestamp
8. **Sign out** — top-right header button → redirected to login

### Verifying tier pricing

Login as `dealer1@example.com` (Gold) and note the prices. Sign out, login as
`dealer2@example.com` (Silver) — the same products cost more.

Pricing is not a blanket percentage: `src/mocks/data/tierPrices.ts` holds one row per
SKU per tier (50 rows, 25 SKUs). Spreads vary by margin — exhaust parts ~10%
Gold-to-Silver, apparel ~15–16% — and `JK400-BLK-S` is an overstock closeout priced
flat below the rest of its size run.

### The pricing model in one table

Money on a SKU row is **per SKU, not per unit**: one SKU is one purchasable thing, a
garment or a whole 6-pack, so price and MAP are both totals for it and compare directly.

| SKU | Pack | Price | MAP | Margin |
|---|---|---|---|---|
| `PL001-BLK-01` | 1 | $17.10 | $39.99 | 57% |
| `PL001-BLK-06` | 6 | $93.60 | $239.94 | 61% |
| `JK400-BLK-M` | 1 | $69.50 | $179.99 | 61% |
| `JK400-BLK-XL` | 1 | $73.50 | $189.99 | 61% |

Pack rows also print the per-unit figure (`$15.60/ea`) so a 6-pack stays comparable to
a single.

Three decisions behind that, each recorded in the architecture doc rather than repeated
here:

| Decision | Where |
|---|---|
| Each SPU has one variant axis — `Size` or `Pack Qty`; size never goes in the SPU code | §2.1, §2.1.1 |
| Tier pricing and MAP are both stated per SKU, with no SPU-level row to inherit from | §2.2, §2.1.2 |
| Quantity-based pricing is deferred, and kept INSERT-only to re-enable | §2.2.1 |

---

## Running against the real backend

The **admin portal talks to the real backend**; the dealer portal is still mocked, because
dealer login does not exist server-side yet.

```bash
# terminal 1 — backend
cd ../b2b-wholesale-backend
docker compose up -d
./gradlew :b2b-start:bootRun

# terminal 2 — frontend
npm run dev
```

Vite proxies `/api` to `localhost:8080`, so the browser stays on one origin and no CORS is
involved. MSW starts with `onUnhandledRequest: 'bypass'` and now registers dealer handlers
only, so `/api/admin/*` falls straight through to the backend while dealer routes are still
served from mocks.

The admin mocks were deleted rather than kept in step with the backend. Two implementations
of one contract drift, and the backend is the one that counts now. The consequence is that
the admin portal needs the backend running.

Sign in with `admin@example.com` / `admin123` (seeded by the backend's `V2` migration).

## Flow 2 — Admin portal

Entry point: http://localhost:5173/admin/login

### Dashboard (`/admin`)

Shows live stat cards:
- Total and active product count
- Registered and active dealer count
- Low-stock alerts (available < 5) and out-of-stock SKU count

### Products (`/admin/products`)

- Search by name or SPU code
- Filter by status (Active / Draft / Archived)
- Sort by SPU code (default), brand or base price, ascending or descending. Clearing a sort returns to SPU code rather than to an undefined order. Sorting is done by the API over the whole result set, not by the table over the current page
- Page size selector: 20 (default), 50 or 100. Changing it returns to the first page, since page 3 of 20-per-page does not exist at 100 per page
- Click the **edit** button (pencil icon) to open the edit form
- Click the **delete** button (trash icon) → confirm popover → product removed

**Product edit form** (`/admin/products/:id/edit`):

| Section | Editable? | Notes |
|---|---|---|
| Product identity | ❌ Read-only | SPU code, name, brand, description, variant axis — **synced from Sellfox**, rendered as text |
| Catalog settings | ✅ | Base wholesale price, location code, status |
| Display attributes | ✅ | Free-form key-value pairs; seeded from Sellfox at import, ours thereafter |
| Images | ✅ | URL list; ↑/↓ buttons reorder; first URL = primary thumbnail |
| Categories | ✅ | Checkbox tree; click "Set primary" to mark the primary category |
| Tier pricing | Price only | One row per SKU × tier, in variant order, with the SKU cell merged down its group |
| SKU variants | MAP only | SKU code, variant value, UPC, weight, stock are synced from Sellfox and read-only; **MAP is editable per SKU** |

### Who owns which field

Sellfox is the system of record for **what a thing is and how many there are**; the
portal owns **what a dealer pays and what they see**. A field owned by both is a field
that loses data. Full table in architecture doc §3.7.7.

Two rules follow, and both are visible in the admin:

1. **Read-only fields render as text, never as a disabled input** — a greyed-out box
   still reads as "editable, just not right now".
2. **There is no manual stock override**, and `/admin/inventory` is read-only. An
   admin-entered figure would be reverted by the next 15-minute sync, and the admin
   would believe it stuck.

The mock `PUT /api/admin/products/:id` **rejects** Sellfox-owned fields with a 400
rather than ignoring them, so a client that tries to edit one fails loudly.

### Categories (`/admin/categories`)

- Click **Add root category** → enter name → added as a top-level node
- Click **+** next to any node → browser prompt for child name
- Click the **pencil** icon → inline text field → press Enter or click ✓ to save
- Click the **trash** icon → confirm popover → node and all its children removed

### Customers (`/admin/customers`)

- Search by name, email, or company
- Filter by status
- Toggle the **Active/Off** switch to enable or disable a dealer account instantly
- Click **Edit** to update name, company, tier, phone, or status
- Click **New Customer** → fill form → account created with `mustChangePassword: true`

### Inventory (`/admin/inventory`)

- Warehouse dropdown: filter to a single warehouse or show all
- **Low stock only** checkbox: show only rows where available stock < 5
- Columns: SKU, Product, SPU Code, Warehouse, Available (stock badge), Incoming (blue), Reserved (orange tag), Defective (red tag), Last Updated
- **Read-only by design** — stock is Sellfox's, and a manual override would be reverted by the next sync. Corrections are made in Sellfox.
- Sign out — header button → redirected to `/admin/login`

---

## Mock data summary

| Entity | Count |
|---|---|
| SPUs (products) | 10 (Auto Parts > Exhaust/Lighting, Apparel > Jackets/Gloves, Tools > Hand Tools) |
| SKUs (variants) | 25 total, 1–4 per SPU |
| Tier price rows | 50 — one per SKU per tier, all at `minQty: 1` |
| Variant axes | Apparel SPUs vary by `Size` (`GL100-BLK-M`); parts and tools vary by `Pack Qty` (`PL001-BLK-06`) |
| Categories | 3 top-level, 2 sub-levels each |
| Dealer accounts | 2 (Gold, Silver) |
| Admin accounts | 1 (Super Admin) |
| Warehouses | 2 (Main, East Coast) |

MSW mock state is **in-memory per page load** — edits made in the admin panel persist for the browser session but reset on refresh.

---

## Project structure

```
src/
├── api/
│   ├── http.ts            # The two axios instances (dealer / admin) + base URL
│   ├── catalog.ts         # Every dealer endpoint, as typed functions
│   ├── adminApi.ts        # Every admin endpoint, as typed functions
│   └── types.ts           # The API contract — all shared interfaces
├── hooks/
│   └── usePagedQuery.ts   # Filter + page + fetch state for every list screen
├── store/                 # Zustand: authStore, adminAuthStore
├── mocks/
│   ├── browser.ts         # MSW worker setup
│   ├── data/              # products, tierPrices, categories, users, admin
│   └── handlers/          # dealerHandlers, adminHandlers, index
├── components/            # Layout, ProductCard, SkuTable, CategoryTree, …
│   └── admin/             # AdminLayout, AdminProtectedRoute
├── pages/                 # Login, Home, Search, ProductDetail
│   └── admin/             # Dashboard, Product/Customer list+form, Category, Inventory
└── utils/                 # money.ts (formatting), stockBadge.tsx
```

## Switching to a real backend

Pages never call axios directly — everything goes through `api/catalog.ts` or
`api/adminApi.ts`. To run against a real service:

1. Set `VITE_API_BASE_URL` to its base URL.
2. Stop starting the MSW worker in `main.tsx` (it is already dev-only).

No page or component changes. If a response shape differs from `api/types.ts`, the
service module is the single place to reconcile it.
