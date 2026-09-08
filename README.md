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
7. **Product detail** (`/products/:spuCode`) — full image gallery, attributes table, complete SKU table with MAP, Volume Price and UPC columns, CSV export button, last-synced timestamp
8. **Sign out** — top-right header button → redirected to login

### Verifying tier pricing

Login as `dealer1@example.com` (Gold) and note the unit prices. Sign out, login as `dealer2@example.com` (Silver) — the same products show higher prices.

Pricing is **not** a blanket percentage. `src/mocks/data/tierPrices.ts` mocks the `tier_price` table and the architecture doc's three-step `resolve_price` fallback:

1. **SKU-level row** wins outright — e.g. `JK400-BLK-S` is overstocked and priced $62.00 / $74.00 flat, below the rest of its size run
2. **SPU-level row** otherwise, plus the SKU's `priceAdjustment` — this is how XL carries its `+$4.00` premium on both tiers
3. **`baseWholesalePrice + priceAdjustment`** if the SPU has no tier rows at all

Spreads vary by margin: commodity exhaust parts run ~10% Gold-to-Silver, apparel ~15–16%. Volume breaks (`minQty`) appear in the **Volume Price** column on the product detail page — Gold pays $69.50 for a `JK400-BLK-M`, or $65.00 each at 6+.

### MAP at SKU level

**MAP lives only on the SKU — there is no SPU-level MAP.** A pack SKU's advertised price scales with its quantity, so there is nothing its SKUs could inherit; rather than inherit on the `Size` axis but not on `Pack Qty`, MAP is always stated per SKU.

**Money on a SKU row is per SKU, not per unit.** One SKU is one purchasable thing — a garment, or a whole 6-pack — so price and MAP are both totals for it and compare directly:

| SKU | Pack | Price | MAP | Margin |
|---|---|---|---|---|
| `PL001-BLK-01` | 1 | $17.10 | $39.99 | 57% |
| `PL001-BLK-06` | 6 | $93.60 | $239.94 | 61% |
| `JK400-BLK-M` | 1 | $69.50 | $179.99 | 61% |
| `JK400-BLK-XL` | 1 | $73.50 | $189.99 | 61% |

Tier price rows stay authored per unit; a SKU's price is the resolved unit price × `packQuantity`. Pack rows print the per-unit figure beneath both totals (`$15.60/ea`, `$39.99/ea`) so a 6-pack stays comparable to a single, and volume breaks are labelled `/ea` for the same reason.

MAP is edited per SKU in the admin product form's **Variants** table — it's the one column there that isn't read-only, since MAP is ours rather than synced from Sellfox.

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
- Filter by status (Active / Draft / Archived)
- Click the **edit** button (pencil icon) to open the edit form
- Click the **delete** button (trash icon) → confirm popover → product removed

**Product edit form** (`/admin/products/:id/edit`):

| Section | Editable? | Notes |
|---|---|---|
| Basic info | ✅ | Name, brand, description, base price, location code, status (MAP is per SKU — see Variants) |
| Display attributes | ✅ | Free-form key-value pairs; add/remove rows |
| Images | ✅ | URL list; ↑/↓ buttons reorder; first URL = primary thumbnail |
| Categories | ✅ | Checkbox tree; click "Set primary" to mark the primary category |
| Tier pricing | ✅ | Price and minimum quantity per customer tier |
| SKU variants | MAP only | SKU code, variant value, UPC, weight, stock are synced from Sellfox and read-only; **MAP is editable per SKU** |

Click **Save Changes** → success toast → back to product list.

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
- Sign out — header button → redirected to `/admin/login`

---

## Mock data summary

| Entity | Count |
|---|---|
| SPUs (products) | 10 (Auto Parts > Exhaust/Lighting, Apparel > Jackets/Gloves, Tools > Hand Tools) |
| SKUs (variants) | 25 total, 1–4 per SPU |
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
│   ├── client.ts          # Axios instance for dealer routes (uses auth_token)
│   ├── adminClient.ts     # Axios instance for admin routes (uses admin_token)
│   └── types.ts           # All TypeScript interfaces
├── store/
│   ├── authStore.ts       # Zustand: dealer auth
│   └── adminAuthStore.ts  # Zustand: admin auth
├── mocks/
│   ├── browser.ts         # MSW worker setup
│   ├── data/
│   │   ├── products.ts    # 10 mock SPUs / 25 SKUs, size or pack-qty variant axis
│   │   ├── tierPrices.ts  # tier_price rows + resolve_price 3-step fallback
│   │   ├── categories.ts  # Category tree
│   │   ├── users.ts       # Dealer accounts
│   │   └── admin.ts       # Admin account, tiers, warehouses, customers
│   └── handlers/
│       ├── dealerHandlers.ts  # POST /api/auth/login, GET /api/products, etc.
│       ├── adminHandlers.ts   # All /api/admin/* endpoints (CRUD + mutable state)
│       └── index.ts           # Combines both handler arrays
├── components/
│   ├── Layout.tsx             # Dealer shell (sticky header, search bar, outlet)
│   ├── ProtectedRoute.tsx
│   ├── CategoryTree.tsx
│   ├── PriceRangeFilter.tsx
│   ├── ProductCard.tsx        # Inline-expanded search result card
│   ├── SkuTable.tsx           # Reusable SKU/stock table
│   └── admin/
│       ├── AdminLayout.tsx        # Collapsible sidebar + header
│       └── AdminProtectedRoute.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── HomePage.tsx
│   ├── SearchPage.tsx
│   ├── ProductDetailPage.tsx
│   └── admin/
│       ├── AdminLoginPage.tsx
│       ├── DashboardPage.tsx
│       ├── ProductListPage.tsx
│       ├── ProductFormPage.tsx    # Edit-only (products synced from Sellfox)
│       ├── CategoryPage.tsx
│       ├── CustomerListPage.tsx
│       ├── CustomerFormPage.tsx
│       └── InventoryPage.tsx
└── utils/
    └── stockBadge.tsx         # Green/orange/red stock indicator
```
