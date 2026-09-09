# B2B Wholesale Portal

A dealer-facing catalog and order-inquiry portal plus an admin management panel for a B2B
wholesale business. Both portals talk to the [Kotlin/Spring backend](../b2b-wholesale-backend),
so it has to be running — see [Running locally](#running-locally).

## Tech stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| UI | Ant Design 6 |
| Routing | React Router v7 |
| State | Zustand 5 |
| HTTP | Axios (separate dealer / admin / auth instances) |

---

## Running locally

Two processes. The frontend has nothing to show without the backend.

```bash
# terminal 1 — backend (Postgres via Docker, then the app on :8080)
cd ../b2b-wholesale-backend
docker compose up -d
SPRING_PROFILES_ACTIVE=local ./gradlew :b2b-start:bootRun

# terminal 2 — frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `localhost:8080`, so the browser stays
on one origin and no CORS is involved.

The `local` profile adds `classpath:db/seed` to Flyway's locations, which is what loads the
sample catalog and the accounts below. Production never lists that location.

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
| dealer1@example.com | dealer123 | Gold (best pricing — 10–16% under Silver depending on the product) |
| dealer2@example.com | dealer123 | Silver |

Both are seeded with the password change already done. To exercise the forced-change
screen, create a customer in the admin portal and sign in with the temporary password it
hands back.

### Admin account

| Email | Password | Role |
|---|---|---|
| admin@example.com | admin123 | Super Admin |

---

## Flow 1 — Dealer portal

Entry point: http://localhost:5173/login

### Step-by-step

1. **Login** — enter dealer credentials → redirected to the search home page.
   A dealer still on an admin-issued temporary password lands on **Choose a password**
   (`/change-password`) instead, and cannot leave it: the token they hold reaches that
   one endpoint and nothing else. Setting a password swaps in a full token.
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

Pricing is not a blanket percentage: the `tier_price` table holds one row per SKU per
tier. Spreads vary by margin — exhaust parts ~10% Gold-to-Silver, apparel ~15–16% — and
`JK400-BLK-S` is an overstock closeout priced flat below the rest of its size run.

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

## Flow 2 — Admin portal

Entry point: http://localhost:5173/admin/login

### Dashboard (`/admin`)

Shows live stat cards:
- Total and active product count
- Registered and active dealer count
- Low-stock alerts (available < 5) and out-of-stock SKU count

### Products (`/admin/products`)

- Search by name or SPU code
- Filter by status (Active / Inactive)
- Sort by SPU code (default), brand or base price, ascending or descending. Clearing a sort returns to SPU code rather than to an undefined order. Sorting is done by the API over the whole result set, not by the table over the current page
- Page size selector: 20 (default), 50 or 100. Changing it returns to the first page, since page 3 of 20-per-page does not exist at 100 per page
- Click the **edit** button (pencil icon) to open the edit form
- Click the **eye** button to hide a product from dealers, or show it again. There is no delete: products come from Sellfox, so a portal delete would be undone by the next sync and would take the pricing with it. Hiding keeps the product, its pricing and its history

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

`PUT /api/admin/products/:id` **rejects** Sellfox-owned fields with a 400 rather than
ignoring them, so a client that tries to edit one fails loudly.

### Categories (`/admin/categories`)

Three levels, no more: **Department › Category › Sub-category**. Each has its own colour,
icon and weight, because at three levels indentation alone stops being legible once nodes
carry counts and buttons. A legend above the tree names them.

- Click **Add department** → enter name → added as a top-level node
- Click **+** next to any node → inline field, placed where the child will appear. The
  button is disabled at level 3, with the reason on hover — the API refuses there too
- Click the **pencil** icon → inline text field → press Enter or click ✓ to save
- Click the **trash** icon → confirm popover → the node goes; any products filed under it
  are **unfiled, not deleted**, and the popover says how many. If one of them had this as
  its primary category, another of its categories takes over
- A node with sub-categories still cannot be deleted. Removing a branch would take nodes
  with it that the admin never saw

Each node carries its own product count. A node with children also carries the **distinct**
products across its whole subtree — distinct, not summed, because a product filed under
both a parent and one of its children is one product.

### Customers (`/admin/customers`)

- Search by name, email, or company
- Filter by status
- Toggle the **Active/Off** switch to enable or disable a dealer account instantly
- Click **Edit** to update name, company, tier, phone, or status
- Click **New Customer** → fill form → account created with `mustChangePassword: true`

### Sellfox Sync (`/admin/sellfox`)

Sellfox is the ERP the catalog comes from. **One job**: it imports the products in the
selected categories, then counts them in the selected warehouses. Scheduled hourly and
runnable by hand from this page; every run is recorded, including the ones that fail.

The two halves are one run and in that order on purpose — a SKU imported by the first
half gets its stock from the second half of the same run. Separately-scheduled jobs meant
a newly imported product sat at zero until the other one came round, which reads to a
dealer as out of stock.

**Scope.** Nothing is imported from a category until it is ticked here, and no stock is
read from a warehouse until that is ticked too, so the first sync on a fresh install only
fills in the two lists. A SKU's stock is the **sum across the selected warehouses** —
which is what keeps China-only stock out of a US availability figure.

**Frequency is set by the expensive half.** Sellfox's commodity endpoint accepts no
category filter, so every run pages the whole catalog — about two minutes. Hourly is the
default; going much below that is mostly re-reading 6,400 rows to find the handful that
changed.

**Imported products arrive inactive and unpriced.** Sellfox has no dealer price, so the
admin sets tier pricing and then activates them; a product cannot reach a dealer at
$0.00 by accident.

**How SPUs are derived.** Sellfox has an `spu` field and leaves it null, so the portal
works one out. There are two cases and they are not the same kind of thing:

- **Packs are declared.** A pack SKU names the single-unit SKU it contains and how many:
  `WM7C310J255-QT4-2` says it holds 2 × `WM7C310J255-QT4-1`. The family and its pack
  quantities come straight from that, with no string parsing — which is why
  `AX-K210-ZN-4` and `AX-K210-ZN-4 S` stay separate products despite differing by one
  token, and why `AX-K318-24` correctly groups with `AX-K318-12` even though no suffix
  rule connects those codes.
- **Sizes are not declared at all.** `KTG-08-S/M/L/XL` are four unrelated rows as far as
  Sellfox is concerned, so this one is inferred — deliberately timidly. The trailing
  token must be a size from a closed list, and at least two SKUs must share a stem with
  different sizes. A lone SKU ending in `-S` stays its own product.

Where the two disagree, the declared relationship wins: one SPU carries one axis.

The scheduler is off by default (`SELLFOX_SCHEDULE_ENABLED`) — two instances running the
same cron would double every sync. A run left `RUNNING` by a crashed process is closed at
startup; otherwise it would refuse every later run as concurrent, showing up only as a
button that stays disabled.

### Inventory (`/admin/inventory`)

- Warehouse dropdown: filter to a single warehouse or show all
- **Low stock only** checkbox: show only rows where available stock < 5
- Columns: SKU, Product, SPU Code, Warehouse, Available (stock badge), Incoming (blue), Reserved (orange tag), Defective (red tag), Last Updated
- **Read-only by design** — stock is Sellfox's, and a manual override would be reverted by the next sync. Corrections are made in Sellfox.
- Sign out — header button → redirected to `/admin/login`

---

## Seeded data summary

Loaded by the backend's `db/seed` migrations under the `local` profile only.

| Entity | Count |
|---|---|
| SPUs (products) | 24 (Auto Parts > Exhaust/Lighting/Hand Tools/Wheels/Brakes, Apparel > Jackets/Gloves/Luggage) |
| SKUs (variants) | 55 total, 1–4 per SPU |
| Tier price rows | 100 — one per SKU per tier |
| Variant axes | Apparel SPUs vary by `Size` (`GL100-BLK-M`); parts and tools vary by `Pack Qty` (`PL001-BLK-06`) |
| Categories | 2 top-level, 8 leaves |
| Dealer accounts | 2 (Gold, Silver) |
| Admin accounts | 1 (Super Admin) |

Unlike the mocks this replaced, edits made in the admin panel are **written to Postgres**
and survive a refresh. `docker compose down -v` resets everything.

---

## Project structure

```
src/
├── api/
│   ├── http.ts            # The three axios instances (dealer / admin / auth) + base URL
│   ├── catalog.ts         # Every dealer endpoint, as typed functions
│   ├── adminApi.ts        # Every admin endpoint, as typed functions
│   └── types.ts           # The API contract — all shared interfaces
├── hooks/
│   └── usePagedQuery.ts   # Filter + page + fetch state for every list screen
├── store/                 # Zustand: authStore, adminAuthStore
├── components/            # Layout, ProductCard, SkuTable, CategoryTree, …
│   └── admin/             # AdminLayout, AdminProtectedRoute
├── pages/                 # Login, ChangePassword, Home, Search, ProductDetail
│   └── admin/             # Dashboard, Product/Customer list+form, Category, Inventory
└── utils/                 # money.ts (formatting), stockBadge.tsx
```

## Pointing at a different backend

Pages never call axios directly — everything goes through `api/catalog.ts` or
`api/adminApi.ts`. Set `VITE_API_BASE_URL` to another service's base URL and no page or
component changes. If a response shape differs from `api/types.ts`, the service module is
the single place to reconcile it.
