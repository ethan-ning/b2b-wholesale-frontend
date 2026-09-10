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
import MoneyInput from '../../components/MoneyInput';
import SkuPricingTable, { buildSkuRows } from '../../components/admin/SkuPricingTable';
import CategoryPicker, { flattenCategories } from '../../components/admin/CategoryPicker';
import type { FlatCategory } from '../../components/admin/CategoryPicker';
import type { SkuRow } from '../../components/admin/SkuPricingTable';
import type { CustomerTier, Product, Variant, WarehouseStock } from '../../api/types';

const { Text } = Typography;

/** Live means green; hidden means grey. Neither is an error, so neither is red. */
const LIVE_BUTTON = { background: '#16a34a', borderColor: '#16a34a', color: '#fff' };
const HIDDEN_BUTTON = { background: '#64748b', borderColor: '#64748b', color: '#fff' };

/** Everything on this page that an admin can change. */
type Draft = {
  baseWholesalePrice: number;
  locationCode: string;
  visibility: string;
  attrRows: { key: string; value: string }[];
  imageUrls: string[];
  categoryIds: number[];
  primaryCategoryId: number | null;
  /** Per-SKU MAP, keyed by variant id — the only portal-owned field on a variant. */
  variantMaps: Record<number, number | null>;
  skuRows: SkuRow[];
};

type SectionKey = 'pricing' | 'categories' | 'media';

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
        d.baseWholesalePrice, d.locationCode, d.visibility,
        d.skuRows.map((r) => [r.key, r.price]), d.variantMaps,
      ]);
    case 'categories':
      return JSON.stringify([d.categoryIds, d.primaryCategoryId]);
    case 'media':
      return JSON.stringify([d.attrRows, d.imageUrls]);
  }
}

function withSection(base: Draft, from: Draft, section: SectionKey): Draft {
  switch (section) {
    case 'pricing':
      return {
        ...base,
        baseWholesalePrice: from.baseWholesalePrice,
        locationCode: from.locationCode,
        visibility: from.visibility,
        skuRows: from.skuRows,
        variantMaps: from.variantMaps,
      };
    case 'categories':
      return { ...base, categoryIds: from.categoryIds, primaryCategoryId: from.primaryCategoryId };
    case 'media':
      return { ...base, attrRows: from.attrRows, imageUrls: from.imageUrls };
  }
}

function toPayload(d: Draft, variants: Variant[]): api.ProductUpdate {
  return {
    baseWholesalePrice: d.baseWholesalePrice,
    locationCode: d.locationCode || null,
    visibility: d.visibility,
    attributes: Object.fromEntries(
      d.attrRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])
    ),
    imageUrls: d.imageUrls,
    categoryIds: d.categoryIds,
    primaryCategoryId: d.primaryCategoryId,
    variantMapPrices: Object.fromEntries(
      variants.map((v) => [v.id!, d.variantMaps[v.id!] ?? null])
    ),
    // Only the rows someone actually filled in — a blank is not a zero.
    tierPrices: d.skuRows
      .filter((r): r is SkuRow & { tier: CustomerTier; price: number } =>
        r.tier !== null && r.price !== null)
      .map((r) => ({ sku: r.variant.sku, tierId: r.tier.id, price: r.price, minQty: r.minQty })),
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // What is on screen, and what the server last accepted. The gap between them is what
  // each section's Save button reports and sends.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [savingWhat, setSavingWhat] = useState<SectionKey | 'all' | null>(null);

  useEffect(() => {
    Promise.all([api.fetchProduct(id!), api.fetchCategories(), api.fetchTiers()])
      .then(([detail, cats, tiers]) => {
        // The price book and the stock breakdown are siblings of the product, not fields on it.
        const p = detail.product;
        const catIds = p.categories.map((c) => c.id);
        const initial: Draft = {
          baseWholesalePrice: p.baseWholesalePrice,
          locationCode: p.locationCode ?? '',
          visibility: p.visibility,
          attrRows: Object.entries(p.attributes).map(([k, v]) => ({ key: k, value: v })),
          imageUrls: [...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url),
          categoryIds: catIds,
          primaryCategoryId: p.categories.find((c) => c.isPrimary)?.id ?? catIds[0] ?? null,
          variantMaps: Object.fromEntries(p.variants.map((v) => [v.id!, v.mapPrice])),
          skuRows: buildSkuRows(p.variants, tiers, detail.tierPrices),
        };
        setProduct(p);
        setStock(detail.stockByWarehouse ?? []);
        setCategories(flattenCategories(cats));
        setDraft(initial);
        setSaved(initial);
      })
      .catch(() => setError('Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoading />;
  if (error || !product || !draft || !saved) {
    return <PageError message={error ?? 'Product not found.'} />;
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const isDirty = (s: SectionKey) => fingerprint(draft, s) !== fingerprint(saved, s);
  const anyDirty = (['pricing', 'categories', 'media'] as SectionKey[]).some(isDirty);

  async function save(what: SectionKey | 'all') {
    const next = what === 'all' ? draft! : withSection(saved!, draft!, what);
    setSavingWhat(what);
    try {
      const result = await api.updateProduct(id!, toPayload(next, product!.variants));
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

  const unpriced = product.sellable === false;
  const visible = draft.visibility === 'VISIBLE';

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
            <Col span={7}>
              <Form.Item
                label="Base Wholesale Price"
                required
                style={{ marginBottom: 16 }}
                tooltip="List price for one unit. Only reached when a SKU has no tier price at all."
              >
                <MoneyInput
                  style={{ width: '100%' }} precision={2}
                  value={draft.baseWholesalePrice}
                  onChange={(v) => patch({ baseWholesalePrice: v ?? 0 })}
                />
              </Form.Item>
            </Col>
            <Col span={7}>
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

          {unpriced && visible && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Price every SKU still on sale before saving this as visible"
              description="Saved as it stands the API will refuse: an unpriced product would be offered at its base price. Fill in the grid below and save both together."
            />
          )}

          <SkuPricingTable
            rows={draft.skuRows}
            variantAxis={product.variantAxis}
            stock={stock}
            mapPrices={draft.variantMaps}
            onPrice={(row, price) =>
              patch({ skuRows: draft.skuRows.map((r) => (r.key === row.key ? { ...r, price } : r)) })}
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

        <Card title="Images & Attributes" size="small" className="section-card section-card--media">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>
              Images <Text type="secondary" style={{ fontWeight: 400 }}>— first is the thumbnail</Text>
            </Text>
            <Button size="small" icon={<PlusOutlined />}
              onClick={() => patch({ imageUrls: [...draft.imageUrls, ''] })}>
              Add image
            </Button>
          </div>

          {draft.imageUrls.length === 0 && <Text type="secondary">No images.</Text>}
          {draft.imageUrls.map((url, i) => (
            <Space key={i} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Text type="secondary" style={{ width: 24, textAlign: 'right', fontSize: 12 }}>{i + 1}.</Text>
              <Input
                value={url}
                placeholder="https://..."
                style={{ width: 480 }}
                onChange={(e) => {
                  const next = [...draft.imageUrls];
                  next[i] = e.target.value;
                  patch({ imageUrls: next });
                }}
              />
              <Button size="small" disabled={i === 0} onClick={() => {
                const next = [...draft.imageUrls];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                patch({ imageUrls: next });
              }}>↑</Button>
              <Button size="small" disabled={i === draft.imageUrls.length - 1} onClick={() => {
                const next = [...draft.imageUrls];
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                patch({ imageUrls: next });
              }}>↓</Button>
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => patch({ imageUrls: draft.imageUrls.filter((_, j) => j !== i) })} />
            </Space>
          ))}

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>
              Attributes <Text type="secondary" style={{ fontWeight: 400 }}>— shown on the dealer page</Text>
            </Text>
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
            dirty={isDirty('media')}
            saving={savingWhat === 'media'}
            onSave={() => save('media')}
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
