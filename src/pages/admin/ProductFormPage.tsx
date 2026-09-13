import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Form, Input,
  Row, Space, Typography, message,
} from 'antd';
import {
  DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined,
} from '@ant-design/icons';
import * as api from '../../api/adminApi';
import { apiErrorMessage } from '../../api/http';
import { PageError, PageLoading } from '../../components/PageState';
import PageHeader from '../../components/admin/PageHeader';
import SkuPricingTable from '../../components/admin/SkuPricingTable';
import ProductGallery from '../../components/admin/ProductGallery';
import CategoryPicker from '../../components/admin/CategoryPicker';
import { buildSkuRows, isCustom } from '../../components/admin/skuRows';
import type { SkuRow } from '../../components/admin/skuRows';
import { flattenCategories } from '../../components/admin/flatCategories';
import type { FlatCategory } from '../../components/admin/flatCategories';
import type { CustomerTier, Product, TierPrice, Variant, WarehouseStock } from '../../api/types';

const { Text } = Typography;

/** Live means green; hidden means grey. Neither is an error, so neither is red. */
const LIVE_BUTTON = { background: '#16a34a', borderColor: '#16a34a', color: '#fff' };
const HIDDEN_BUTTON = { background: '#64748b', borderColor: '#64748b', color: '#fff' };

/** Everything on this page that an admin can change. */
type Draft = {
  /** Undefined while the box is empty mid-edit. A price is never legitimately absent. */
  locationCode: string;
  visibility: string;
  attrRows: { key: string; value: string }[];
  categoryIds: number[];
  primaryCategoryId: number | null;
  /** Per-SKU MAP, keyed by variant id — the only portal-owned field on a variant. */
  variantMaps: Record<number, number | null>;
  /**
   * Prices typed on this page but not yet saved, keyed "sku:tierId" — a SKU's default
   * price among them, since that is just the anchor tier's entry. Null means the box was
   * emptied, which gives the price back rather than setting it to zero.
   */
  priceEdits: Record<string, number | null>;
};

type SectionKey = 'pricing' | 'categories' | 'attributes';

/**
 * What each section owns, for comparing and for merging.
 *
 * Both matter, because a section's Save persists only that section. The API replaces the
 * whole product in one call, so saving prices has to send the categories too — and it
 * sends the *saved* ones, not whatever is half-edited further down the page. Otherwise a
 * button labelled Save beside the price grid would quietly commit an unfinished edit
 * somewhere the admin is not looking.
 */
function fingerprint(d: Draft, section: SectionKey): string {
  switch (section) {
    case 'pricing':
      return JSON.stringify([
        d.locationCode, d.visibility,
        d.priceEdits, d.variantMaps,
      ]);
    case 'categories':
      return JSON.stringify([d.categoryIds, d.primaryCategoryId]);
    case 'attributes':
      return JSON.stringify(d.attrRows);
  }
}

function withSection(base: Draft, from: Draft, section: SectionKey): Draft {
  switch (section) {
    case 'pricing':
      return {
        ...base,
        locationCode: from.locationCode,
        visibility: from.visibility,
        priceEdits: from.priceEdits,
        variantMaps: from.variantMaps,
      };
    case 'categories':
      return { ...base, categoryIds: from.categoryIds, primaryCategoryId: from.primaryCategoryId };
    case 'attributes':
      return { ...base, attrRows: from.attrRows };
  }
}

/**
 * What gets saved.
 *
 * Every SKU's default price, plus only those tier prices that actually differ from what
 * the discount gives. A figure equal to the rate is the rate, so storing it would freeze
 * the SKU at today's number and quietly stop it following a later change to the tier.
 */
function toPayload(d: Draft, variants: Variant[], rows: SkuRow[], anchorTierId: number | null): api.ProductUpdate {
  return {
    locationCode: d.locationCode || null,
    visibility: d.visibility,
    attributes: Object.fromEntries(
      d.attrRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])
    ),
    categoryIds: d.categoryIds,
    primaryCategoryId: d.primaryCategoryId,
    variantMapPrices: Object.fromEntries(
      variants.map((v) => [v.id!, d.variantMaps[v.id!] ?? null])
    ),
    tierPrices: rows.flatMap((row) => {
      const priced: { sku: string; tierId: number; price: number; minQty: number }[] = [];
      if (anchorTierId !== null && row.defaultPrice !== null) {
        priced.push({ sku: row.variant.sku, tierId: anchorTierId, price: row.defaultPrice, minQty: 1 });
      }
      row.tiers.filter(isCustom).forEach((tier) => {
        priced.push({ sku: row.variant.sku, tierId: tier.tier.id, price: tier.price!, minQty: 1 });
      });
      return priced;
    }),
  };
}

/** Sits at the foot of an editable section. Inert until that section has something to save. */
function SectionSave({ dirty, saving, onSave }: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="section-footer">
      {dirty && <Text type="warning" style={{ fontSize: 12 }}>Unsaved changes</Text>}
      <Button size="small" type="primary" disabled={!dirty} loading={saving} onClick={onSave}>
        Save this section
      </Button>
    </div>
  );
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [stock, setStock] = useState<WarehouseStock[]>([]);
  // Kept rather than consumed at load: the rows are rebuilt on every keystroke of the base
  // price, so the tiers and the saved book have to still be here to rebuild them from.
  const [tiers, setTiers] = useState<CustomerTier[]>([]);
  const [tierPrices, setTierPrices] = useState<TierPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // What is on screen, and what the server last accepted. The gap between them is what
  // each section's Save button reports and sends.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [savingWhat, setSavingWhat] = useState<SectionKey | 'all' | null>(null);

  useEffect(() => {
    // Guarded like the shared hooks are: leaving the page mid-load otherwise flushes an
    // update into a component that no longer exists.
    let current = true;
    Promise.all([api.fetchProduct(id!), api.fetchCategories(), api.fetchTiers()])
      .then(([detail, cats, tiers]) => {
        if (!current) return;
        // The price book and the stock breakdown are siblings of the product, not fields on it.
        const p = detail.product;
        const catIds = p.categories.map((c) => c.id);
        const initial: Draft = {
          locationCode: p.locationCode ?? '',
          visibility: p.visibility,
          attrRows: Object.entries(p.attributes).map(([k, v]) => ({ key: k, value: v })),
          categoryIds: catIds,
          primaryCategoryId: p.categories.find((c) => c.isPrimary)?.id ?? catIds[0] ?? null,
          variantMaps: Object.fromEntries(p.variants.map((v) => [v.id!, v.mapPrice])),
          priceEdits: Object.fromEntries(
            detail.tierPrices
              .filter((r) => r.customised)
              .map((r) => [`${r.sku}:${r.tierId}`, r.price]),
          ),
        };
        setProduct(p);
        setTiers(tiers);
        setTierPrices(detail.tierPrices);
        setStock(detail.stockByWarehouse ?? []);
        setCategories(flattenCategories(cats));
        setDraft(initial);
        setSaved(initial);
      })
      .catch(() => { if (current) setError('Failed to load product.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id]);

  if (loading) return <PageLoading />;
  if (error || !product || !draft || !saved) {
    return <PageError message={error ?? 'Product not found.'} />;
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const isDirty = (s: SectionKey) => fingerprint(draft, s) !== fingerprint(saved, s);
  const anyDirty = (['pricing', 'categories', 'attributes'] as SectionKey[]).some(isDirty);

  async function save(what: SectionKey | 'all') {
    const next = what === 'all' ? draft! : withSection(saved!, draft!, what);
    // Rebuilt from the draft being saved, not the one on screen, so a section's Save
    // sends that section's prices and not a half-finished edit further down the page.
    const rowsToSave = buildSkuRows(product!.variants, tiers, tierPrices, next.priceEdits);
    setSavingWhat(what);
    try {
      const result = await api.updateProduct(
        id!, toPayload(next, product!.variants, rowsToSave, anchorTier?.id ?? null),
      );
      setProduct(result.product);
      setSaved(next);
      message.success(what === 'all' ? 'Product saved' : 'Section saved');
      if (what === 'all') navigate('/admin/products');
    } catch (e: unknown) {
      // Surfaced verbatim: a refusal names the SPU and says what to do about it.
      message.error(apiErrorMessage(e, 'Could not save.'));
    } finally {
      setSavingWhat(null);
    }
  }

  function toggleCategory(catId: number, checked: boolean) {
    if (checked) {
      patch({ categoryIds: [...new Set([...draft!.categoryIds, catId])] });
      // First one in takes the primary slot. Silent while it is the only candidate; once a
      // second category arrives the control appears already pointing at this one.
      if (draft!.primaryCategoryId === null) patch({ primaryCategoryId: catId });
      return;
    }
    const remaining = draft!.categoryIds.filter((x) => x !== catId);
    patch({
      categoryIds: remaining,
      primaryCategoryId:
        draft!.primaryCategoryId === catId ? remaining[0] ?? null : draft!.primaryCategoryId,
    });
  }

  const visible = draft.visibility === 'VISIBLE';

  // Rebuilt from the figures in the form rather than the ones last saved, so a default
  // price moves its tiers as it is typed.
  const anchorTier = tiers.find((t) => t.anchor);
  const skuRows = buildSkuRows(product.variants, tiers, tierPrices, draft.priceEdits);

  /*
   * Said before it is tried, not after. Shown whether or not Visible is selected: the
   * product cannot be shown either way, and finding that out by pressing the button and
   * being refused is how someone ends up looking for a setting that does not exist.
   */
  const blocked = product.sellable === false
    ? product.unsellableReason === 'NOTHING_ON_SALE'
      ? {
          message: 'Every SKU of this product is discontinued',
          description:
            'The supplier has stopped listing them, so there is nothing for a dealer to buy '
            + 'and this product cannot be shown. Nothing here will change that — it needs to '
            + 'come back on the next sync.',
        }
      : {
          message: 'This product has no base wholesale price',
          description:
            'Every tier takes its discount off that figure, so at nothing the product would '
            + 'be offered free. Set a base wholesale price above and save.',
        }
    : null;

  return (
    <div style={{ maxWidth: 1240 }}>
      <PageHeader
        title={<>Edit Product — <code style={{ fontSize: 16 }}>{product.spuCode}</code></>}
        backTo="/admin/products"
        backLabel="Back to Products"
      />

      <Form layout="vertical">

        {/* Sellfox's, and only displayed. Text rather than disabled inputs — a greyed-out
            box still reads as "editable, just not right now" — and a flat recessed panel
            rather than a form, so the eye skips it on the way to what can be changed. */}
        <Card title="Product" size="small" className="section-card">
          <Descriptions size="small" column={2} bordered className="section-readonly" items={[
            { key: 'spu', label: 'SPU Code', children: <code>{product.spuCode}</code> },
            { key: 'brand', label: 'Brand', children: product.brand ?? '—' },
            { key: 'name', label: 'Product Name', span: 2, children: product.name },
            { key: 'desc', label: 'Description', span: 2, children: product.description ?? '—' },
            {
              key: 'axis', label: 'Variant Axis', span: 2,
              children: product.variantAxis
                ? <>{product.variantAxis} <Text type="secondary">({product.variants.length} SKUs)</Text></>
                : '—',
            },
          ]} />
        </Card>

        <Card title="Pricing, Stock & Visibility" size="small" className="section-card section-card--pricing">
          <Row gutter={16} align="bottom">
            <Col span={10}>
              <Form.Item
                label="Location Code"
                style={{ marginBottom: 16 }}
                tooltip="Warehouse bin. Editable until we confirm Sellfox exposes bin codes (doc §3.7.7)."
              >
                <Input
                  placeholder="A1-1"
                  value={draft.locationCode}
                  onChange={(e) => patch({ locationCode: e.target.value })}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Visibility to dealers" style={{ marginBottom: 16 }}>
                {/* Two buttons rather than a dropdown or a neutral toggle. Live is green
                    and hidden is grey, so the state reads from across the room — this is
                    the one field on the page that decides whether dealers see anything. */}
                <Space.Compact style={{ width: '100%' }}>
                  <Button
                    style={{ width: '50%', ...(visible ? LIVE_BUTTON : {}) }}
                    icon={<EyeOutlined />}
                    onClick={() => patch({ visibility: 'VISIBLE' })}
                  >
                    Visible
                  </Button>
                  <Button
                    style={{ width: '50%', ...(visible ? {} : HIDDEN_BUTTON) }}
                    icon={<EyeInvisibleOutlined />}
                    onClick={() => patch({ visibility: 'HIDDEN' })}
                  >
                    Hidden
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          {blocked && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={blocked.message}
              description={blocked.description}
            />
          )}

          <SkuPricingTable
            rows={skuRows}
            variantAxis={product.variantAxis}
            stock={stock}
            mapPrices={draft.variantMaps}
            onPrice={(sku, tierId, price) =>
              patch({ priceEdits: { ...draft.priceEdits, [`${sku}:${tierId}`]: price } })}
            onDefaultPrice={(sku, price) => {
              if (!anchorTier) return;
              patch({ priceEdits: { ...draft.priceEdits, [`${sku}:${anchorTier.id}`]: price } });
            }}
            onMapPrice={(variantId, price) =>
              patch({ variantMaps: { ...draft.variantMaps, [variantId]: price } })}
          />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            A pack SKU's price is for the whole pack, not one of its contents.
          </Text>
          <SectionSave
            dirty={isDirty('pricing')}
            saving={savingWhat === 'pricing'}
            onSave={() => save('pricing')}
          />
        </Card>

        <CategoryPicker
          categories={categories}
          selectedIds={draft.categoryIds}
          primaryId={draft.primaryCategoryId}
          onToggle={toggleCategory}
          onPrimary={(catId) => patch({ primaryCategoryId: catId })}
          footer={
            <SectionSave
              dirty={isDirty('categories')}
              saving={savingWhat === 'categories'}
              onSave={() => save('categories')}
            />
          }
        />

        <Card title="Images" size="small" className="section-card section-card--media">
          <ProductGallery
            productId={product.id}
            images={product.images}
            variants={product.variants}
            variantAxis={product.variantAxis}
          />
        </Card>

        <Card title="Attributes" size="small" className="section-card section-card--attributes">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Shown on the dealer product page.</Text>
            <Button size="small" icon={<PlusOutlined />}
              onClick={() => patch({ attrRows: [...draft.attrRows, { key: '', value: '' }] })}>
              Add attribute
            </Button>
          </div>

          {draft.attrRows.length === 0 && <Text type="secondary">No attributes.</Text>}
          {draft.attrRows.map((row, i) => (
            <Space key={i} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Input
                placeholder="Key (e.g. Color)"
                value={row.key}
                style={{ width: 160 }}
                onChange={(e) => {
                  const next = [...draft.attrRows];
                  next[i] = { ...next[i], key: e.target.value };
                  patch({ attrRows: next });
                }}
              />
              <Input
                placeholder="Value (e.g. Black)"
                value={row.value}
                style={{ width: 200 }}
                onChange={(e) => {
                  const next = [...draft.attrRows];
                  next[i] = { ...next[i], value: e.target.value };
                  patch({ attrRows: next });
                }}
              />
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => patch({ attrRows: draft.attrRows.filter((_, j) => j !== i) })} />
            </Space>
          ))}

          <SectionSave
            dirty={isDirty('attributes')}
            saving={savingWhat === 'attributes'}
            onSave={() => save('attributes')}
          />
        </Card>

        <Divider />
        <Space>
          <Button
            type="primary"
            loading={savingWhat === 'all'}
            disabled={!anyDirty}
            onClick={() => save('all')}
          >
            Save all changes
          </Button>
          <Button onClick={() => navigate('/admin/products')}>
            {anyDirty ? 'Discard and go back' : 'Back to Products'}
          </Button>
          {anyDirty && (
            <Text type="warning" style={{ fontSize: 12 }}>
              Unsaved changes in this page
            </Text>
          )}
        </Space>
      </Form>
    </div>
  );
}
