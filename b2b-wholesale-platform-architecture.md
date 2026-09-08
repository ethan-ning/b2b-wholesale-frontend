# B2B Wholesale Platform — Architecture Assessment

> **Platform**: Generic B2B wholesale catalog — stock and pricing lookup for dealers/distributors
> **Reference UX patterns**: [DealerLeather.com](https://www.dealerleather.com/) (dealer portal UX)

---

## 1. Overview

This document assesses the architecture for a wholesale B2B platform serving dealer networks. The **MVP focus is stock and pricing lookup** — dealers authenticate, browse the catalog, check real-time stock levels, and view their tier-specific pricing. Order/checkout is deferred to V2.

**Core MVP value proposition**: A dealer logs in, finds a product (by category browse or SKU search), sees their tier price + MAP + available/incoming stock across all variants, and can export or share that lookup.

**MVP out of scope**: Cart, order submission, payment, order history, shipment tracking.

**Deferred to V2**: Self-serve registration, order management, multi-warehouse inventory, payment processing.

**Tech stack**: Kotlin + Spring Boot 3.x (backend), ReactJS + TypeScript (frontend), **PostgreSQL on Cloud SQL**, containerized on **GKE Autopilot**, US region. Inventory data sourced from **Sellfox ERP** via pull-based sync.

---

## 2. Data Model (PostgreSQL)

### 2.1 Product & Variant Model

The catalog uses a **two-level hierarchy**: SPU (Standard Product Unit) and SKU (Stock Keeping Unit).

- **SPU** (`product` table) — a specific style/color of a product; identified by `spu_code` (e.g., `PL001-BLK`, `GL100-BLK`). This is what dealers browse and what carries the MAP price.
- **SKU** (`product_variant` table) — a purchasable unit under an SPU. The SKU code is the SPU code plus a suffix carrying the variant value (e.g., `PL001-BLK-06`, `GL100-BLK-M`).

**Each SPU has exactly one variant axis** — the single dimension its SKUs vary along, named by `product.variant_axis`:

| Category | Axis | SPU | SKUs |
|---|---|---|---|
| Apparel (jackets, gloves, chaps) | `Size` | `GL100-BLK` | `GL100-BLK-S`, `-M`, `-L`, `-XL` |
| Parts, tools, accessories | `Pack Qty` | `PL001-BLK` | `PL001-BLK-01`, `-06` |

Color is **not** an axis — it belongs to the SPU code, so a black and a brown jacket are two SPUs. This matches the MAP-per-color observation below, and keeps a single axis per SPU so the variant table stays a flat list rather than a matrix.

No attribute EAV system is needed — style/color/material are implicitly encoded in the SPU code and name; catalog filtering is by category, brand, and SKU/SPU code search only.

```sql
-- Trigger function: auto-update updated_at on any row update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Category tree (e.g., Auto Parts > Exhaust, Apparel > Jackets)
CREATE TABLE category (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    parent_id    BIGINT REFERENCES category(id),
    sort_order   INT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Product / SPU: one row per style or color variant
-- spu_code is the business identifier and URL key (e.g., "PL001-BLK")
-- MAP lives here because it can differ per style variant (observed: same base product,
-- different MAP per color on DealerLeather)
CREATE TABLE product (
    id                    BIGSERIAL PRIMARY KEY,
    spu_code              TEXT NOT NULL UNIQUE,        -- "PL001-BLK"; used as URL slug
    name                  TEXT NOT NULL,               -- "Black Series A Muffler"
    brand                 TEXT,
    description           TEXT,
    base_wholesale_price  DECIMAL(10,2) NOT NULL,      -- SPU-level fallback price
    map_price             DECIMAL(10,2),               -- Minimum Advertised Price for this SPU
    location_code         TEXT,                        -- warehouse bin/shelf code at SPU level (e.g., "B6-1")
    variant_axis          TEXT,                        -- what this SPU's SKUs vary along: "Size" | "Pack Qty"; NULL for single-SKU SPUs
    attributes_jsonb      JSONB,                       -- display-only key-value pairs, e.g. {"color":"Black","material":"Stainless Steel"}
    status                TEXT NOT NULL DEFAULT 'DRAFT'
                              CHECK (status IN ('ACTIVE','DRAFT','ARCHIVED')),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_product_updated_at
    BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_product_brand ON product (brand);

-- Product variant / SKU: one row per value of the parent SPU's variant_axis
-- sku = spu_code + variant suffix, e.g., "GL100-BLK" → "GL100-BLK-M"; "PL001-BLK" → "PL001-BLK-06"
CREATE TABLE product_variant (
    id               BIGSERIAL PRIMARY KEY,
    product_id       BIGINT NOT NULL REFERENCES product(id),  -- FK to SPU
    sku              TEXT NOT NULL UNIQUE,     -- full SKU code: "GL100-BLK-M"
    variant_value    TEXT,                     -- value on the SPU's axis: "M", "XL", "6"; matches the SKU suffix
    sort_order       INT NOT NULL DEFAULT 0,   -- sizes are not lexically ordered (S < M < L < XL), so order explicitly
    pack_quantity    INT NOT NULL DEFAULT 1,   -- units per SKU; 1 for size-differentiated apparel
    price_adjustment DECIMAL(10,2) DEFAULT 0.00,  -- delta from SPU base/tier price
    upc              VARCHAR(14),              -- GS1 UPC/EAN; each pack size has its own
    weight           DECIMAL(8,3),            -- weight of this pack (kg or lb)
    internal_ref     TEXT,                    -- non-Sellfox ERP/supplier reference (for Sellfox, see sellfox_sku_mapping)
    status           TEXT NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','DISCONTINUED')),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pv_product ON product_variant (product_id);
CREATE INDEX idx_pv_sku ON product_variant (sku);

-- Product images: one row per image, linked to SPU (product)
-- Admin uploads to Cloud Storage, then creates a record here with the resulting URL
-- sort_order controls display sequence; the image with the lowest sort_order is the primary/thumbnail
CREATE TABLE product_image (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,          -- GCS public/signed URL: "gs://bucket/products/PL001-BLK/1.jpg"
    alt_text    TEXT,                   -- optional accessibility / SEO description
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_product_image_product ON product_image (product_id, sort_order);

-- Product ↔ Category: many-to-many (a product can appear in multiple categories)
-- is_primary = TRUE on exactly one row per product — drives breadcrumb and default category display
-- Category hierarchy is queried via recursive CTE on category.parent_id (see §3.4)
CREATE TABLE product_category (
    product_id   BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    category_id  BIGINT NOT NULL REFERENCES category(id),
    is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (product_id, category_id)
);
CREATE INDEX idx_product_category_cat ON product_category (category_id);
```

### 2.1.1 Design Notes — Attributes and SPU/SKU Code Convention

**Attributes (`attributes_jsonb` on `product`)**: Stored as a freeform JSONB display bag — e.g., `{"color": "Black", "material": "Stainless Steel"}`. Rendered on the product page as a key-value list. No schema definition table or EAV: attribute keys are admin-entered and not used for querying or filtering, so schema enforcement at the DB level is unnecessary overhead.

**SPU/SKU code convention**: The `spu_code` on `product` and `sku` on `product_variant` follow a **structured prefix convention**:

```
{base_model}-{style_suffix}         = spu_code    e.g. PL001-BLK,     GL100-BLK
{spu_code}-{variant_suffix}         = sku          e.g. PL001-BLK-06,  GL100-BLK-M
```

- `base_model` identifies the product family grouping (e.g., `PL001` = a specific muffler model). Used in search and display; not a formal FK — just a naming convention.
- `style_suffix` encodes color/material/style (e.g., `-BLK`, `-SS`). Absent when there's only one style (e.g., `PL001` is itself a valid spu_code).
- `variant_suffix` is the SKU's value on the parent SPU's `variant_axis` — a size code for apparel (`-S`, `-M`, `-XL`), a zero-padded pack count for parts (`-01`, `-06`). Application validates that the suffix matches `variant_value`, and that pack suffixes are consistent with `pack_quantity`.

**Do not encode size in the `spu_code`.** `GL100-BLK-M` is a SKU under SPU `GL100-BLK`, not an SPU of its own. Promoting sizes to SPUs fragments one product into a dozen catalog entries, duplicates its images and MAP, and leaves each with a single meaningless SKU — dealers then can't see size availability side by side, which is the primary apparel lookup.

**DealerLeather observations informing this model:**

| Observation | Impact on Model |
|---|---|
| MAP differs between color variants of the same base model | `map_price` on `product` (SPU), not on `product_variant` |
| Location code (e.g., "B6-1") is the same across all sizes of a product | `location_code` on `product` (SPU level) |
| Internal supplier/ERP reference per variant | `internal_ref` on `product_variant` |
| Each purchasable unit has its own UPC barcode | `upc` on `product_variant` |
| Apparel sold by size; parts sold by pack | `variant_axis` on `product` names the axis; `variant_value` on `product_variant` carries the value |
| Larger sizes / smaller packs priced differently | `price_adjustment` on `product_variant` (e.g., XL +$4.00, 6-pack −$1.50/unit) |

### 2.2 Customer & Pricing

```sql
-- Pricing tiers (admin-defined; N tiers, e.g., Platinum / Gold / Silver / Bronze)
CREATE TABLE customer_tier (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    sort_order   INT DEFAULT 0,
    description  TEXT
);

-- Dealer accounts (admin-created only; no self-serve registration at MVP)
CREATE TABLE customer (
    id                    BIGSERIAL PRIMARY KEY,
    email                 TEXT NOT NULL UNIQUE,
    password_hash         TEXT NOT NULL,
    name                  TEXT NOT NULL,
    company_name          TEXT NOT NULL,
    tier_id               BIGINT NOT NULL REFERENCES customer_tier(id),
    phone                 TEXT,
    must_change_password  BOOLEAN DEFAULT TRUE,  -- forced on first login
    status                TEXT NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE','DISABLED')),
    created_by_admin_id   BIGINT REFERENCES admin_user(id),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_customer_updated_at
    BEFORE UPDATE ON customer FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tiered pricing: defined at SPU level and/or SKU level
-- variant_id IS NULL → price applies to all SKUs under that SPU (SPU-level price)
-- variant_id IS NOT NULL → price applies to that specific SKU only (SKU-level override)
CREATE TABLE tier_price (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES product(id),          -- SPU
    variant_id  BIGINT REFERENCES product_variant(id),           -- SKU; NULL = SPU-level
    tier_id     BIGINT NOT NULL REFERENCES customer_tier(id),
    price       DECIMAL(10,2) NOT NULL,
    min_qty     INT DEFAULT 1,    -- applies when order qty >= min_qty
    UNIQUE (product_id, variant_id, tier_id, min_qty)
);
CREATE INDEX idx_tier_price_lookup ON tier_price (variant_id, tier_id, min_qty);

-- Warehouses: named physical or virtual stock locations
-- Seeded from Sellfox warehouse list; also supports manually-defined warehouses
CREATE TABLE warehouse (
    id                    BIGSERIAL PRIMARY KEY,
    name                  TEXT NOT NULL,          -- "Main Warehouse", "LA Distribution Center"
    code                  TEXT NOT NULL UNIQUE,   -- short code used in location_code references: "WH-MAIN"
    type                  INT DEFAULT 0,          -- mirrors Sellfox: 0=default,1=domestic,2=FBA,3=overseas
    sellfox_warehouse_id  BIGINT UNIQUE,          -- Sellfox warehouse ID; NULL for manually-defined warehouses
    active                BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory: stock levels per SKU per warehouse
-- Populated and kept current by Sellfox sync job (see §2.3, §3.7)
-- Dealer-facing API aggregates across active warehouses unless per-warehouse breakdown requested
CREATE TABLE inventory (
    id                    BIGSERIAL PRIMARY KEY,
    variant_id            BIGINT NOT NULL REFERENCES product_variant(id),
    warehouse_id          BIGINT NOT NULL REFERENCES warehouse(id),
    available_stock       INT NOT NULL DEFAULT 0,   -- Sellfox: stockAvailable
    incoming_stock        INT NOT NULL DEFAULT 0,   -- Sellfox: stockWait (in-transit POs)
    reserved_stock        INT NOT NULL DEFAULT 0,   -- Sellfox: stockOccupy (unfulfilled orders)
    defective_stock       INT NOT NULL DEFAULT 0,   -- Sellfox: stockDefective (not shown to dealers)
    expected_arrival_date DATE,
    reorder_point         INT DEFAULT 0,
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (variant_id, warehouse_id)
);
CREATE INDEX idx_inventory_variant ON inventory (variant_id);

CREATE TABLE admin_user (
    id             BIGSERIAL PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    name           TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'ADMIN'
                       CHECK (role IN ('SUPER_ADMIN','ADMIN')),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

**Pricing resolution** (most specific match wins):

```
resolve_price(skuId, spuId, tierId, quantity):
  1. tier_price WHERE variant_id = skuId AND tier_id = tierId AND min_qty <= quantity
     ORDER BY min_qty DESC LIMIT 1                            -- SKU-level price
  2. tier_price WHERE product_id = spuId AND variant_id IS NULL
     AND tier_id = tierId AND min_qty <= quantity             -- SPU-level fallback
  3. product.base_wholesale_price + product_variant.price_adjustment  -- ultimate fallback
```

### 2.3 Sellfox Integration Tables

```sql
-- Maps our product_variant.sku to Sellfox commoditySku, scoped to a warehouse
-- One row per (local SKU, warehouse) pair — a SKU can exist in multiple warehouses
CREATE TABLE sellfox_sku_mapping (
    id                    BIGSERIAL PRIMARY KEY,
    variant_id            BIGINT NOT NULL REFERENCES product_variant(id),
    warehouse_id          BIGINT NOT NULL REFERENCES warehouse(id),   -- our warehouse record
    sellfox_commodity_id  BIGINT,               -- Sellfox internal commodity ID
    sellfox_sku           TEXT NOT NULL,         -- Sellfox commoditySku
    last_synced_at        TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (sellfox_sku, warehouse_id)
);
CREATE INDEX idx_sfx_variant ON sellfox_sku_mapping (variant_id);
CREATE INDEX idx_sfx_sku ON sellfox_sku_mapping (sellfox_sku);

-- Audit log for each sync run
CREATE TABLE sellfox_sync_log (
    id                  BIGSERIAL PRIMARY KEY,
    sync_type           TEXT NOT NULL CHECK (sync_type IN ('INVENTORY_FULL','INVENTORY_INCREMENTAL','SKU_CATALOG')),
    status              TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCESS','FAILED')),
    warehouse_id        BIGINT REFERENCES warehouse(id),   -- NULL = all warehouses
    records_processed   INT DEFAULT 0,
    records_failed      INT DEFAULT 0,
    error_message       TEXT,
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);
```

---

## 3. Backend Architecture (Kotlin + Spring Boot 3.x)

### 3.1 Spring Framework Features in Use

| Feature | Purpose |
|---------|---------|
| **Spring Security 6 (OAuth2 Resource Server)** | JWT validation via `JwtDecoder` + `BearerTokenAuthenticationFilter` — no custom filter |
| **Spring Data JPA + Specifications** | `JpaSpecificationExecutor<T>` for dynamic catalog filters (category, brand, JSONB attribute values, status) |
| **Spring Cache + Caffeine** | `@Cacheable` on pricing resolution and category tree; `@CacheEvict` via Spring Events |
| **Spring Batch** | Admin bulk CSV import for pricing and inventory; chunk-processing, skip policies, restart capability |
| **Spring Scheduler** | `@Scheduled` for Sellfox inventory sync (every 15 min incremental, daily full) |
| **Springdoc OpenAPI 3** | Auto-generates `/v3/api-docs` → TypeScript client via OpenAPI Generator |
| **Spring Validation (Jakarta Bean Validation 3.0)** | `@Valid` + custom `@Constraint` annotations on request DTOs |
| **Spring Boot Actuator** | `/actuator/health`, `/actuator/metrics`, `/actuator/prometheus` |
| **Spring Events (`ApplicationEventPublisher`)** | `InventoryUpdatedEvent`, `PriceUpdatedEvent` — decoupled cache eviction |
| **Spring AOP** | `@Aspect` for MDC request/response logging (correlation ID, dealer tier) |
| **Flyway** | Schema migrations via `spring.flyway.*` auto-configuration |

### 3.2 Module Structure

```
b2b-wholesale/
├── build.gradle.kts                (Kotlin 2.0+, Spring Boot 3.3+, Java 21)
├── settings.gradle.kts
│
├── app/                            (deployable Spring Boot application)
│   └── src/main/kotlin/com/acme/b2b/
│       ├── B2bApplication.kt
│       └── config/
│           ├── SecurityConfig.kt       (Spring Security 6, OAuth2 Resource Server)
│           ├── CacheConfig.kt          (Caffeine cache manager, TTL definitions)
│           ├── BatchConfig.kt          (Spring Batch job definitions)
│           ├── SchedulerConfig.kt      (@EnableScheduling)
│           ├── WebConfig.kt            (CORS, Jackson)
│           └── OpenApiConfig.kt        (Springdoc tags, security scheme)
│
├── domain/                         (pure business logic, framework-free)
│   └── src/main/kotlin/com/acme/b2b/domain/
│       ├── model/                  (Customer, Product, ProductVariant, Tier — data classes)
│       ├── pricing/
│       │   ├── PricingEngine.kt    (resolve_price with 3-step fallback)
│       │   └── PricingEvent.kt
│       ├── inventory/
│       │   ├── InventoryService.kt
│       │   └── InventoryEvent.kt
│       └── sellfox/
│           ├── SellfoxSyncService.kt   (orchestrates sync schedule)
│           ├── SellfoxApiClient.kt     (HTTP client + auth signing)
│           └── SellfoxFieldMapper.kt  (Sellfox response → domain inventory)
│
├── api/                            (REST layer)
│   └── src/main/kotlin/com/acme/b2b/api/
│       ├── controller/
│       │   ├── AuthController.kt
│       │   ├── CatalogController.kt
│       │   ├── InventoryController.kt
│       │   └── admin/
│       │       ├── AdminCustomerController.kt
│       │       ├── AdminProductController.kt
│       │       ├── AdminPricingController.kt
│       │       ├── AdminInventoryController.kt
│       │       └── AdminSellfoxController.kt   (manual sync trigger, mapping CRUD)
│       ├── dto/
│       ├── spec/
│       │   └── ProductSpecifications.kt        (JSONB attribute containment specs)
│       └── aspect/
│           └── RequestLoggingAspect.kt
│
├── infra/                          (persistence)
│   └── src/main/kotlin/com/acme/b2b/infra/
│       ├── entity/
│       ├── repository/
│       └── mapper/
│
└── src/main/resources/
    ├── application.yml
    ├── application-local.yml
    └── db/migration/
```

### 3.3 Spring Security 6 — OAuth2 Resource Server JWT

```kotlin
// SecurityConfig.kt
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity, jwtDecoder: JwtDecoder): SecurityFilterChain =
        http
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers("/api/auth/login", "/actuator/health").permitAll()
                    .requestMatchers("/api/admin/**").hasRole("ADMIN")
                    .anyRequest().hasAnyRole("DEALER", "ADMIN")
            }
            .oauth2ResourceServer { it.jwt { jwt -> jwt.decoder(jwtDecoder) } }
            .build()

    @Bean
    fun jwtDecoder(@Value("\${jwt.secret}") secret: String): JwtDecoder =
        NimbusJwtDecoder.withSecretKey(SecretKeySpec(secret.toByteArray(), "HmacSHA256")).build()

    @Bean
    fun jwtAuthenticationConverter(): JwtAuthenticationConverter =
        JwtAuthenticationConverter().apply {
            setJwtGrantedAuthoritiesConverter { jwt ->
                listOf(SimpleGrantedAuthority("ROLE_${jwt.getClaimAsString("role")}"))
            }
        }
}
```

`AuthController` issues HS256-signed JWTs `{ sub, role, tierId, email }`. Validation is handled entirely by Spring Security's resource server — no custom `OncePerRequestFilter` needed.

### 3.4 Spring Data Specifications — Dynamic Catalog Filtering

The catalog endpoint supports filtering by category, brand, attribute values (via JSONB containment), and status:

```kotlin
// ProductSpecifications.kt
object ProductSpecifications {
    fun inCategory(categoryId: Long?): Specification<ProductEntity> =
        categoryId?.let {
            Specification { root, _, cb -> cb.equal(root.get<Long>("categoryId"), it) }
        } ?: Specification.where(null)

    fun hasBrand(brand: String?): Specification<ProductEntity> =
        brand?.let {
            Specification { root, _, cb -> cb.equal(root.get<String>("brand"), it) }
        } ?: Specification.where(null)

    fun isActive(): Specification<ProductEntity> =
        Specification { root, _, cb -> cb.equal(root.get<String>("status"), "ACTIVE") }

    fun spuCodeContains(q: String?): Specification<ProductEntity> =
        q?.let {
            Specification { root, _, cb ->
                cb.like(cb.lower(root.get("spuCode")), "%${it.lowercase()}%")
            }
        } ?: Specification.where(null)

    fun priceInRange(min: BigDecimal?, max: BigDecimal?): Specification<ProductEntity> =
        Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            min?.let { predicates.add(cb.greaterThanOrEqualTo(root.get("baseWholesalePrice"), it)) }
            max?.let { predicates.add(cb.lessThanOrEqualTo(root.get("baseWholesalePrice"), it)) }
            cb.and(*predicates.toTypedArray())
        }
}

// Category filter uses a native recursive CTE to include all descendant categories.
// Not expressible as a Specification; executed as a native query in ProductRepository:
//
//   @Query(value = """
//     WITH RECURSIVE cat_tree AS (
//       SELECT id FROM category WHERE id = :categoryId
//       UNION ALL
//       SELECT c.id FROM category c JOIN cat_tree ct ON c.parent_id = ct.id
//     )
//     SELECT DISTINCT p.* FROM product p
//     JOIN product_category pc ON pc.product_id = p.id
//     WHERE pc.category_id IN (SELECT id FROM cat_tree)
//       AND p.status = 'ACTIVE'
//   """, nativeQuery = true)
//   fun findAllInCategoryTree(@Param("categoryId") categoryId: Long, pageable: Pageable): Page<ProductEntity>
```

### 3.5 Spring Cache — Pricing + Category Tree

```kotlin
@Configuration
@EnableCaching
class CacheConfig {
    @Bean
    fun cacheManager(): CacheManager = CaffeineCacheManager().apply {
        setCaffeine(Caffeine.newBuilder().expireAfterWrite(10, MINUTES).maximumSize(5000))
        setCacheNames(listOf("pricing", "categoryTree", "variantAttributes"))
    }
}

@Service
class PricingEngine(private val tierPriceRepository: TierPriceRepository) {

    @Cacheable("pricing", key = "#variantId + ':' + #tierId + ':' + #quantity")
    fun resolvePrice(variantId: Long, tierId: Long, quantity: Int): BigDecimal { ... }

    @CacheEvict("pricing", allEntries = true)
    @EventListener
    fun onPriceUpdated(event: PriceUpdatedEvent) { /* invalidate on admin price change */ }
}
```

### 3.6 Spring Batch — Bulk CSV Import

Admin imports pricing and inventory updates via CSV. Spring Batch provides chunk-based processing, skip policies (bad rows logged, job continues), and restart capability:

```kotlin
@Configuration
class BatchConfig(private val jobRepository: JobRepository, private val ds: DataSource) {

    @Bean
    fun pricingImportJob(pricingImportStep: Step): Job =
        JobBuilder("pricingImportJob", jobRepository).start(pricingImportStep).build()

    @Bean
    fun pricingImportStep(reader: FlatFileItemReader<TierPriceCsvRow>,
                          processor: TierPriceItemProcessor,
                          writer: TierPriceItemWriter): Step =
        StepBuilder("pricingImportStep", jobRepository)
            .chunk<TierPriceCsvRow, TierPriceEntity>(500, PlatformTransactionManager(ds))
            .reader(reader)
            .processor(processor)   // validates + resolves product/variant IDs
            .writer(writer)         // upserts into tier_price
            .faultTolerant()
            .skip(ValidationException::class.java).skipLimit(100)
            .build()
}
```

Admin uploads CSV via `POST /api/admin/pricing/bulk-upload` (multipart); controller saves to Cloud Storage and triggers the Batch job via `JobLauncher`.

### 3.7 Sellfox Stock Sync

#### 3.7.1 Architecture Overview

The platform pulls inventory data from Sellfox ERP on a schedule. Sellfox is the system of record for stock; the platform's `inventory` table is a read-optimized replica updated by the sync service.

```
Sellfox Open Platform API
  POST /api/warehouseManage/warehouseItemList.json
          │
          ▼
  SellfoxSyncService (Spring @Scheduled)
    ├─ incremental sync every 15 min (modifiedTimeStart filter)
    └─ full sync daily at 02:00
          │
          ▼
  sellfox_sku_mapping      (Sellfox SKU → our variant_id)
          │
          ▼
  inventory table          (available_stock, incoming_stock, ...)
          │
          ▼
  ApplicationEventPublisher → InventoryUpdatedEvent → @CacheEvict
```

#### 3.7.2 Sellfox Auth — Request Signing

Every Sellfox API request requires signed query parameters:

| Param | Value |
|---|---|
| `client_id` | `SELLFOX_APP_ID` (369036) |
| `access_token` | OAuth token obtained from Sellfox token endpoint |
| `timestamp` | Current time in milliseconds (13 digits) |
| `nonce` | Random integer |
| `sign` | HMAC-MD5 of sorted param key+value pairs + app secret |

```kotlin
@Component
class SellfoxApiClient(
    @Value("\${sellfox.app-id}") private val appId: String,
    @Value("\${sellfox.app-secret}") private val appSecret: String,
    @Value("\${sellfox.base-url}") private val baseUrl: String,
    private val restTemplate: RestTemplate,
) {
    private val tokenRef = AtomicReference<SellfoxToken?>()

    private fun buildSignedParams(extraParams: Map<String, String> = emptyMap()): Map<String, String> {
        val token = ensureValidToken()
        val params = buildMap {
            putAll(extraParams)
            put("client_id", appId)
            put("access_token", token.value)
            put("timestamp", System.currentTimeMillis().toString())
            put("nonce", (100000..999999).random().toString())
        }
        val signInput = params.entries.sortedBy { it.key }
            .joinToString("") { "${it.key}${it.value}" } + appSecret
        return params + ("sign" to DigestUtils.md5DigestAsHex(signInput.toByteArray()).uppercase())
    }

    fun <T> post(path: String, body: Any, responseType: Class<T>): T {
        val params = buildSignedParams()
        val url = UriComponentsBuilder.fromHttpUrl("$baseUrl$path")
            .queryParams(LinkedMultiValueMap<String, String>().apply {
                params.forEach { (k, v) -> add(k, v) }
            }).toUriString()
        return restTemplate.postForObject(url, body, responseType)!!
    }

    private fun ensureValidToken(): SellfoxToken {
        // obtain/refresh access_token using app-id + app-secret
        // cache with TTL from Sellfox token response (typically 7200s)
        ...
    }
}
```

**Credentials** are stored in GCP Secret Manager and injected at runtime — never committed to source. Local dev uses `application-local.yml` referencing `~/.env` values.

#### 3.7.3 Warehouse Discovery

On startup and refreshed daily, the sync service fetches the list of active Sellfox warehouses:

```kotlin
@Service
class SellfoxWarehouseService(private val client: SellfoxApiClient) {

    @Cacheable("sellfoxWarehouses")
    fun loadWarehouses(): List<SellfoxWarehouse> {
        val response = client.post(
            "/api/warehouseManage/warehouseList.json",
            emptyMap<String, Any>(),
            SellfoxWarehouseListResponse::class.java
        )
        return response.data.rows
            .filter { it.warehouseType in listOf(0, 1) }  // default + domestic only for MVP
    }
}
```

Warehouse IDs are used as scope when calling the inventory endpoint.

#### 3.7.4 Inventory Sync Flow

```kotlin
@Service
class SellfoxSyncService(
    private val client: SellfoxApiClient,
    private val warehouseService: SellfoxWarehouseService,
    private val skuMappingRepo: SellfoxSkuMappingRepository,
    private val inventoryRepo: InventoryRepository,
    private val syncLogRepo: SellfoxSyncLogRepository,
    private val eventPublisher: ApplicationEventPublisher,
) {
    // Incremental sync: fetch only records modified in the last 20 minutes
    // (overlapping window intentional to avoid gaps at boundary)
    @Scheduled(fixedRate = 900_000)  // every 15 minutes
    fun syncIncremental() = runSync("INVENTORY_INCREMENTAL") { warehouseId ->
        val since = Instant.now().minusSeconds(1200)
        fetchInventoryPage(warehouseId, modifiedSince = since)
    }

    // Full sync: fetch all SKUs (reconciles any drift)
    @Scheduled(cron = "0 0 2 * * *")  // daily at 02:00
    fun syncFull() = runSync("INVENTORY_FULL") { warehouseId ->
        fetchInventoryPage(warehouseId, modifiedSince = null)
    }

    private fun runSync(type: String, fetcher: (Long) -> List<SellfoxInventoryRow>) {
        val log = syncLogRepo.save(SellfoxSyncLog(syncType = type, status = "RUNNING"))
        var processed = 0; var failed = 0
        try {
            warehouseService.loadWarehouses().forEach { warehouse ->
                val rows = fetcher(warehouse.warehouseId)
                rows.chunked(500).forEach { batch ->
                    processInventoryBatch(batch)
                    processed += batch.size
                }
            }
            syncLogRepo.save(log.copy(status = "SUCCESS", recordsProcessed = processed, completedAt = Instant.now()))
            eventPublisher.publishEvent(InventoryUpdatedEvent(this))
        } catch (ex: Exception) {
            syncLogRepo.save(log.copy(status = "FAILED", recordsProcessed = processed,
                recordsFailed = failed, errorMessage = ex.message, completedAt = Instant.now()))
            throw ex
        }
    }

    private fun fetchInventoryPage(warehouseId: Long, modifiedSince: Instant?): List<SellfoxInventoryRow> {
        val allRows = mutableListOf<SellfoxInventoryRow>()
        var pageNum = 1
        do {
            val request = buildMap {
                put("warehouseId", warehouseId)
                put("pageNum", pageNum)
                put("pageSize", 100)
                modifiedSince?.let { put("modifiedTimeStart", it.toEpochMilli()) }
            }
            val resp = client.post("/api/warehouseManage/warehouseItemList.json",
                request, SellfoxInventoryResponse::class.java)
            allRows.addAll(resp.data.rows)
            pageNum++
        } while (allRows.size < resp.data.totalSize)
        return allRows
    }

    private fun processInventoryBatch(rows: List<SellfoxInventoryRow>) {
        val mappings = skuMappingRepo.findBySellfoxSkuIn(rows.map { it.commoditySku })
            .associateBy { it.sellfoxSku }
        rows.forEach { row ->
            val mapping = mappings[row.commoditySku] ?: return@forEach  // unmapped SKU — skip
            inventoryRepo.upsertByVariantId(
                variantId        = mapping.variantId,
                availableStock   = row.stockAvailable,
                incomingStock    = row.stockWait,
                reservedStock    = row.stockOccupy,
                defectiveStock   = row.stockDefective,
                updatedAt        = Instant.now()
            )
            skuMappingRepo.updateLastSynced(mapping.id, Instant.now())
        }
    }
}
```

#### 3.7.5 Sellfox → Inventory Field Mapping

| Sellfox field | Our `inventory` column | Notes |
|---|---|---|
| `commoditySku` | lookup via `sellfox_sku_mapping` | → `variant_id` |
| `stockAvailable` | `available_stock` | Real-time sellable stock |
| `stockWait` | `incoming_stock` | In-transit from purchase orders |
| `stockOccupy` | `reserved_stock` | Allocated to unfulfilled orders (V2 relevance) |
| `stockDefective` | `defective_stock` | Hidden from dealer view |
| `stockAllNum` | computed | `= available + occupy + defective` (not stored separately) |
| `perPurchase` | — | Unit cost; not stored at MVP, useful for margin reporting in V2 |

#### 3.7.6 Initial SKU Catalog Import (Optional)

On first deployment, the admin can trigger a one-time SKU import from Sellfox to seed the product catalog:

```
POST /api/warehouseManage/warehouseList.json      → get warehouse IDs
POST /api/commodity/pageList.json                 → paginate all SKUs with attributes
  Response: commoditySku, commodityName, weight, dimensions, brand, category,
            commodityAttributeValueRelaList (attribute key+value pairs)
```

The import creates `product_variant` rows, maps `commodityAttributeValueRelaList` to `variant_attribute` EAV entries, and populates `attributes_jsonb`. The admin still sets pricing tiers after import — Sellfox only provides cost/stock, not dealer pricing.

Admin endpoint: `POST /api/admin/sellfox/sync-sku-catalog` — triggers a Spring Batch job that reads pages from Sellfox and upserts into the product catalog.

### 3.8 Key API Endpoints (MVP Scope)

**Auth** — public

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | email + password → `{ accessToken, refreshToken, mustChangePassword }` |
| POST | `/api/auth/refresh` | refresh token → new access token |
| POST | `/api/auth/change-password` | clears `must_change_password` flag |

**Catalog** — `ROLE_DEALER` or `ROLE_ADMIN`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/categories` | full category tree (cached) |
| GET | `/api/products?category=&brand=&search=&page=` | paginated SPU list; `search` matches on `spu_code` or `name` |
| GET | `/api/products/{spuCode}` | SPU detail: name, MAP, brand + all SKUs with tier-resolved prices and stock |
| GET | `/api/products/{spuCode}/pricing-grid` | SKU × price table for dealer's tier; drives VariantGrid |
| POST | `/api/inventory/bulk-check` | `{ variantIds: [] }` → `{ variantId, available, incoming, updatedAt }[]` |
| GET | `/api/products/search?q=` | SKU / name full-text search |

**Admin** — `ROLE_ADMIN`

| Method | Path | Notes |
|--------|------|-------|
| CRUD | `/api/admin/customers` | create dealer, assign tier, reset password |
| POST | `/api/admin/customers/{id}/reset-password` | sets temp password, forces change on next login |
| CRUD | `/api/admin/tiers` | manage pricing tiers |
| CRUD | `/api/admin/products`, `/api/admin/categories` | product + category management |
| CRUD | `/api/admin/products/{id}/variants` | variant + attribute editing |
| GET | `/api/admin/pricing/export?productId=` | CSV export of pricing matrix |
| POST | `/api/admin/pricing/bulk-upload` | multipart CSV → Spring Batch job |
| GET/PUT | `/api/admin/inventory/{variantId}` | manual stock override |
| POST | `/api/admin/inventory/bulk-upload` | CSV bulk stock update (Spring Batch) |
| GET | `/api/admin/sellfox/sync-logs` | recent sync run history |
| POST | `/api/admin/sellfox/trigger-sync` | manually trigger an immediate full sync |
| CRUD | `/api/admin/sellfox/sku-mappings` | manage Sellfox SKU ↔ variant mappings |
| POST | `/api/admin/sellfox/sync-sku-catalog` | one-time import from Sellfox commodity list |

---

## 4. Frontend Architecture (ReactJS)

### 4.1 Tech Stack

| Tool | Choice | Rationale |
|------|--------|-----------|
| Build | Vite | Fast dev server, lean bundles |
| Language | TypeScript | Type-safe API integration |
| Router | React Router v6 | SPA routing |
| State | Zustand | Lightweight global state (auth, session) |
| UI Library | Ant Design 5 | Data-dense B2B tables, editable grids, form validation |
| HTTP | Axios | JWT interceptor (auto-refresh, 401 redirect to `/login`) |
| API Types | OpenAPI Generator | TypeScript client from Springdoc `/v3/api-docs` |

### 4.2 Page Map (MVP Scope)

```
/login                              (public)
/change-password                    (forced for new accounts)

— Dealer —
/catalog                            product grid, category sidebar, attribute filters, search
/catalog/:productId                 product detail + VariantGrid (pricing + stock per variant)
/quick-lookup                       SKU/part number search → jump to product

— Admin —
/admin                              dashboard: low stock alerts, recent Sellfox sync status
/admin/customers                    dealer list, create/edit, tier assignment
/admin/tiers                        tier CRUD
/admin/products                     product list
/admin/products/:id                 edit product + manage variants + attributes
/admin/products/:id/pricing         tier pricing matrix editor
/admin/inventory                    stock view, manual override, bulk CSV upload
/admin/sellfox                      sync log viewer, manual trigger, SKU mapping editor
```

### 4.3 Key Component: VariantGrid

The central dealer UX — a table of SKUs under a single SPU. **The second column is titled from the SPU's `variant_axis`**, so the same component serves both catalogs:

```
SPU: GL100-BLK — Riding Gloves, Black  |  MAP: $36.99  |  Category: Apparel > Gloves

┌─────────────────┬──────────┬─────────┬────────────┬────────────┐
│ SKU             │ Size     │ Price   │ Available  │ Incoming   │
├─────────────────┼──────────┼─────────┼────────────┼────────────┤
│ GL100-BLK-S     │ S        │ $15.30  │ ●●● 22     │ —          │
│ GL100-BLK-M     │ M        │ $15.30  │ ●●● 14     │ —          │
│ GL100-BLK-L     │ L        │ $15.30  │ ● 6        │ ↓ 10 (ETA) │
│ GL100-BLK-XL    │ XL       │ $16.15  │ ○ 0        │ ↓ 15 (ETA) │
└─────────────────┴──────────┴─────────┴────────────┴────────────┘

SPU: PL001-BLK — Muffler Extension Pipe, Black  |  MAP: $39.99  |  Category: Auto Parts > Exhaust

┌─────────────────┬──────────┬─────────┬────────────┬────────────┐
│ SKU             │ Pack Qty │ Price   │ Available  │ Incoming   │
├─────────────────┼──────────┼─────────┼────────────┼────────────┤
│ PL001-BLK-01    │ 1        │ $16.15  │ ●●● 25     │ —          │
│ PL001-BLK-06    │ 6        │ $14.88  │ ● 4        │ ↓ 12 (ETA) │
└─────────────────┴──────────┴─────────┴────────────┴────────────┘
Last synced: 4 min ago   [Export to CSV]
```

- Rows arrive in `product_variant.sort_order` — sizes are not lexically ordered, so the API returns them pre-sorted and the client does not re-sort
- Price shown is dealer's tier price; recalculates if a quantity input is provided
- Stock badge: green ≥ 10, yellow 1–9, red 0 (defective stock never shown)
- `Last synced` from `inventory.updated_at` — tells dealer how fresh the stock data is
- CSV export (dealers paste into their own quoting/ordering tools)

### 4.4 Admin: Pricing Matrix Editor

Ant Design `EditableProTable` for bulk pricing management:

```
Product: Classic Leather Jacket  (all variants)

┌──────────────┬─────────────────┬──────────────────┬──────────────┬───────────────┐
│ SKU          │ Bronze (qty ≥1) │ Bronze (qty ≥10) │ Gold (qty ≥1)│ Gold (qty ≥10)│
├──────────────┼─────────────────┼──────────────────┼──────────────┼───────────────┤
│ JKT-BLK-S    │ [   52.00     ] │ [    49.00     ] │ [  45.00   ] │ [   42.00   ] │
│ JKT-BLK-M    │ [   52.00     ] │ [    49.00     ] │ [  45.00   ] │ [   42.00   ] │
│ JKT-RED-S    │ [   55.00     ] │ [    52.00     ] │ [  48.00   ] │ [   45.00   ] │
└──────────────┴─────────────────┴──────────────────┴──────────────┴───────────────┘
[Export CSV]  [Import CSV]  [Save All]
```

---

## 5. Google Cloud Deployment (GKE)

### 5.1 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Google Cloud — us-central1                                        │
│                                                                    │
│  Cloud DNS ──► Cloud Load Balancer (HTTPS, managed TLS cert)      │
│                          │                                         │
│                          ▼                                         │
│  ┌──────────────── GKE Autopilot ────────────────────────┐        │
│  │  Namespace: b2b-wholesale                              │        │
│  │                                                        │        │
│  │  nginx-ingress                                         │        │
│  │    /api/*  ──────────────► api-deployment              │        │
│  │    /*      ──────────────► frontend-deployment         │        │
│  │                                                        │        │
│  │  api-deployment                   frontend-deployment  │        │
│  │  ┌──────────────────────┐        ┌─────────────────┐  │        │
│  │  │ spring-boot:8080     │        │ nginx:80        │  │        │
│  │  │ cloud-sql-proxy:5432 │        │ (React SPA)     │  │        │
│  │  │ (sidecar)            │        └─────────────────┘  │        │
│  │  └──────────────────────┘        Replicas: 2          │        │
│  │  Replicas: 2-8 (HPA, CPU 70%)                         │        │
│  │  Resources: 500m-2000m CPU, 512Mi-2Gi                 │        │
│  │                                                        │        │
│  └────────────────────────────────────────────────────────┘        │
│                          │                                         │
│                          ▼                                         │
│  Cloud SQL for PostgreSQL 16 (Private IP, VPC peering)            │
│  Cloud Storage (product images, CSV uploads)                       │
│  Secret Manager (DB creds, JWT secret, Sellfox APP_SECRET)        │
│  Artifact Registry (Docker images)                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 K8s Resource Layout

```
k8s/
├── namespace.yaml
├── api/
│   ├── deployment.yaml       # Spring Boot + cloud-sql-proxy sidecar (port 5432 for PG)
│   ├── service.yaml          # ClusterIP, port 8080
│   ├── hpa.yaml              # min:2, max:8, targetCPUUtilizationPercentage:70
│   └── configmap.yaml        # SPRING_PROFILES_ACTIVE, DB_NAME, GCS_BUCKET
├── frontend/
│   ├── deployment.yaml       # nginx + React build artifacts
│   └── service.yaml          # ClusterIP, port 80
├── ingress.yaml              # path-based routing, TLS via cert-manager
└── external-secrets.yaml     # External Secrets Operator → Secret Manager
```

Multi-stage Dockerfiles: Kotlin builds in a Gradle image, artifact copied to `eclipse-temurin:21-jre-alpine`. React builds in a node image, output copied to `nginx:alpine`.

### 5.3 CI/CD (GitHub Actions)

Repository: `github.com/ethan-ning/design-docs` (or new dedicated repo), token in `~/Develop/testspace/.env`.

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  backend:
    steps:
      - run: ./gradlew build test
      - run: docker build -t us-central1-docker.pkg.dev/$PROJECT/b2b/api:$SHA .
      - run: docker push ...
      - run: kubectl set image deployment/api app=.../api:$SHA

  frontend:
    steps:
      - run: npm ci && npm run build
      - run: docker build -t us-central1-docker.pkg.dev/$PROJECT/b2b/frontend:$SHA .
      - run: docker push ...
      - run: kubectl set image deployment/frontend nginx=.../frontend:$SHA
```

- `dev` environment: auto-deploys on push to `main`
- `prod` environment: manual approval gate via GitHub Environments

### 5.4 Estimated Monthly Cost (MVP)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| GKE Autopilot | 2 API pods (0.5 vCPU, 1GB) + 2 FE pods (0.25 vCPU, 256MB) | ~$50–70 |
| Cloud SQL PostgreSQL | db-f1-micro, 10GB SSD, automated backups | ~$13 |
| Cloud Storage | < 5GB product images + CSV uploads | ~$1 |
| Cloud Load Balancer | 1 forwarding rule + managed TLS | ~$20 |
| Artifact Registry | < 5GB Docker images | ~$1 |
| Cloud DNS | 1 zone | ~$1 |
| **Total** | | **~$86–106/month** |

---

## 6. Build & Maintain

### 6.1 MVP Development Estimate (1 full-stack developer)

| Phase | Scope | Days |
|-------|-------|------|
| Project scaffolding | Gradle multi-module, Flyway, Docker, K8s manifests, GitHub Actions | 3 |
| Auth system | Spring Security 6 OAuth2 RS, JWT issue/validate, forced password change | 3 |
| Admin: customer + tier management | CRUD dealers, tier assignment, reset password | 2–3 |
| Product + attribute system | Category tree, products, EAV + JSONB attributes, variants | 5–6 |
| Pricing engine + cache | Tier × variant × qty resolution, `@Cacheable`, cache eviction via Spring Events | 3–4 |
| Inventory management | Stock display, manual override, bulk CSV via Spring Batch | 2–3 |
| Sellfox sync integration | SellfoxApiClient (auth signing), sync scheduler, SKU mapping, sync log | 4–5 |
| Catalog API + Specifications | Product browse/search with JSONB attribute filters | 3–4 |
| Dealer: catalog + VariantGrid | Product browse UI, dynamic attribute columns, pricing/stock display | 5–6 |
| Admin: product/pricing/inventory/sellfox UIs | CRUD panels, pricing matrix editor, CSV import, sync viewer | 4–5 |
| GKE deployment + CI/CD | K8s manifests, Cloud SQL PostgreSQL, Secret Manager, GitHub Actions | 3 |
| Testing + hardening | Integration tests, security review, N+1 query audit | 3 |
| **Total** | | **~40–50 days** |

### 6.2 Key Technical Risks

| Risk | Mitigation |
|------|-----------|
| **EAV read performance** | `attributes_jsonb` on `product_variant` is the read path; EAV is write-only source of truth. GIN index handles containment queries. Audit with `EXPLAIN ANALYZE` before launch. |
| **Pricing cache staleness** | Spring Events + `@CacheEvict` invalidate on every admin price change. 10-min TTL is a safety net, not primary eviction. |
| **Sellfox API rate limiting** | Incremental sync with 15-min interval keeps request volume low. Batch up to 100 SKUs per call. Back off exponentially on 429 responses. |
| **Sellfox auth token expiry** | `SellfoxApiClient` uses `AtomicReference<SellfoxToken>` with TTL check; refreshes proactively before expiry. Thread-safe for concurrent scheduled jobs. |
| **Sellfox SKU mapping gaps** | New Sellfox SKUs not in `sellfox_sku_mapping` are silently skipped during sync. Admin UI shows unmatched Sellfox SKUs so they can be mapped or imported. |
| **Inventory data freshness** | Incremental sync runs every 15 min. VariantGrid displays `Last synced: N min ago` so dealers have visibility into data age. Add a staleness alert if sync fails for > 1 hour. |
| **Batch job failures on bad CSV** | Spring Batch skip policy logs bad rows to an error report returned to admin. Job continues processing valid rows. |
| **JSONB attribute migration** | If a new category introduces an attribute with a colliding key name used differently elsewhere, the GIN index still works — queries are per-product scoped. No schema migration needed. |

### 6.3 Scaling Path (Post-MVP)

1. **Order & checkout (V2)** — add cart, order submission, order history (order schema can be derived from pricing model; stock reservation via `reserved_stock` already tracked from Sellfox)
2. **Payment** — NET30 invoice terms common in B2B; defer payment gateway until validated
3. **Self-serve registration** — signup form + admin approval queue (`status = PENDING_APPROVAL`)
4. **Per-customer pricing overrides** — `customer_price_override(customer_id, variant_id, price)` table
5. **Multi-warehouse inventory** — extend `inventory` with `warehouse_id`; aggregate or ship-from logic at API level. `sellfox_sku_mapping.warehouse_id` already models this
6. **Full-text product search** — PostgreSQL `tsvector` + `GIN` for MVP scale; migrate to Elasticsearch when catalog exceeds 50K SKUs
7. **Sellfox webhook (push vs pull)** — if Sellfox supports outbound webhooks, replace polling scheduler with event receiver for near-real-time inventory
8. **Reporting dashboard** — pricing history, stock velocity, dealer lookup analytics
9. **Email notifications** — low stock alerts, price change notifications, sync failure alerts

### 6.4 Monitoring & Observability

| Concern | Tool |
|---------|------|
| Application metrics | Spring Actuator `/actuator/prometheus` → Prometheus → Grafana |
| Logs | Structured JSON (Logback + `logstash-logback-encoder`) → Cloud Logging |
| Request tracing | MDC correlation ID injected by `RequestLoggingAspect` (`@Aspect`) |
| Uptime | Cloud Monitoring check on `GET /actuator/health` |
| Alerts | Error rate > 1%, P99 > 2s, pod restarts > 2/5min, Cloud SQL CPU > 80% |
| Sellfox sync health | Custom `MeterRegistry` counter on sync success/failure; alert if no successful sync in 1 hour |
| Pricing cache hit rate | Custom metric on `PricingEngine`; alert if hit rate drops below 80% |

---

## 7. Open Questions (Deferred)

| Question | Default for MVP |
|----------|----------------|
| Order placement (V2) | Not in MVP; dealers use pricing/stock lookup to inform offline or phone orders |
| Payment terms | NET30 invoice assumed; no payment gateway at MVP |
| Tax calculation | Collect `tax_id` on customer profile; mark `tax_exempt`; actual calculation deferred to V2 |
| Shipping rates | Not applicable at MVP (no orders) |
| Minimum order quantity (MOQ) | `product_variant.pack_quantity` covers pack-size minimums; apparel SKUs are `pack_quantity = 1` and rely on `tier_price.min_qty` breaks instead |
| Concurrent stock reservation | Not needed at MVP (no cart/checkout); relevant in V2 |
| Sellfox FBA / overseas warehouses | Warehouse type 2/3 excluded from MVP sync; extend `sellfox_sku_mapping` scope in V2 |
| Sellfox product catalog completeness | If Sellfox SKU attributes lack English names, use `commodityAttributeValueRelaList` EN fields; fall back to manual admin mapping |
