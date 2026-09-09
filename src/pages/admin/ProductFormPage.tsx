import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form, Input, InputNumber, Select, Button, Card, Typography, Space, Table,
  Spin, Alert, Divider, Tag, message, Checkbox, Row, Col, Descriptions,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type { Category, CustomerTier, Product, TierPrice, Variant } from '../../api/types';

const { Title, Text } = Typography;

// Flatten categories for checkbox display
function flattenCats(cats: Category[], prefix = ''): { id: number; label: string; parentId: number | null }[] {
  const result: { id: number; label: string; parentId: number | null }[] = [];
  for (const c of cats) {
    result.push({ id: c.id, label: prefix + c.name, parentId: c.parentId });
    if (c.children.length) result.push(...flattenCats(c.children, prefix + c.name + ' › '));
  }
  return result;
}

/** A pricing row being edited. Unlike the saved shape, its price may be blank. */
type DraftTierPrice = Omit<TierPrice, 'price'> & { price: number | null };

/**
 * One row per SKU per tier, seeded from whatever is already priced.
 *
 * Discontinued SKUs are left out: the supplier has stopped selling them, they no longer
 * count toward whether the product can go on sale, and offering a box to price them
 * would invite work that changes nothing.
 */
function buildTierGrid(
  variants: Variant[],
  tiers: CustomerTier[],
  existing: TierPrice[],
): DraftTierPrice[] {
  const priced = new Map(existing.map((r) => [`${r.sku}:${r.tierId}:${r.minQty}`, r]));
  return variants
    .filter((v) => v.status !== 'DISCONTINUED')
    .flatMap((variant) =>
      tiers.map((tier) => {
        const found = priced.get(`${variant.sku}:${tier.id}:1`);
        return {
          sku: variant.sku,
          tierId: tier.id,
          tierName: tier.name,
          minQty: 1,
          price: found?.price ?? null,
        };
      }),
    );
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<{ id: number; label: string; parentId: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic attribute rows
  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([]);
  // Image URLs
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  // Selected category IDs + primary category
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [primaryCatId, setPrimaryCatId] = useState<number | null>(null);
  // Per-SKU MAP, keyed by variant id — the only place MAP is edited.
  const [variantMaps, setVariantMaps] = useState<Record<number, number | null>>({});
  /**
   * A row per SKU per tier, whether or not a price exists yet.
   *
   * Built from the variants rather than from the price book: a product that has never
   * been priced has an empty price book, and rendering that gave an empty table with
   * nothing to type into — which is exactly the product that most needs pricing.
   *
   * `price` is null for a row nobody has filled in. Null and 0 are not the same thing:
   * a blank leaves the SKU unpriced, while a zero would price it at nothing and let it
   * go on sale for free.
   */
  const [tierRows, setTierRows] = useState<DraftTierPrice[]>([]);

  useEffect(() => {
    Promise.all([api.fetchProduct(id!), api.fetchCategories(), api.fetchTiers()])
      .then(([detail, cats, tiers]) => {
        // The price book is a sibling of the product, not a field on it.
        const p = detail.product;
        setProduct(p);
        setAttrRows(Object.entries(p.attributes).map(([k, v]) => ({ key: k, value: v })));
        setImageUrls(
          [...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url)
        );
        setVariantMaps(Object.fromEntries(p.variants.map((v) => [v.id!, v.mapPrice])));
        setTierRows(buildTierGrid(p.variants, tiers, detail.tierPrices));
        const catIds = p.categories.map((c) => c.id);
        setSelectedCatIds(catIds);
        setPrimaryCatId(p.categories.find((c) => c.isPrimary)?.id ?? catIds[0] ?? null);
        setCategories(flattenCats(cats));
        form.setFieldsValue({
          baseWholesalePrice: p.baseWholesalePrice,
          locationCode: p.locationCode,
          status: p.visibility,
        });
      })
      .catch(() => setError('Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id, form]);

  async function onFinish(values: {
    baseWholesalePrice: number;
    locationCode: string; status: string;
  }) {
    setSaving(true);
    try {
      // Only portal-owned fields. The API has no field for name, brand or description,
      // so there is nothing to accidentally send.
      const payload: api.ProductUpdate = {
        baseWholesalePrice: values.baseWholesalePrice,
        locationCode: values.locationCode || null,
        visibility: values.status,
        attributes: Object.fromEntries(attrRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])),
        imageUrls,
        categoryIds: selectedCatIds,
        primaryCategoryId: primaryCatId,
        // Variants are otherwise the ERP's, but MAP is ours.
        variantMapPrices: Object.fromEntries(
          product!.variants.map((v) => [v.id!, variantMaps[v.id!] ?? null])
        ),
        // Only the rows someone actually filled in. Sending a blank as 0 would price
        // the SKU at nothing and let it go on sale for free.
        tierPrices: tierRows
          .filter((r): r is DraftTierPrice & { price: number } => r.price !== null)
          .map((r) => ({ sku: r.sku, tierId: r.tierId, price: r.price, minQty: r.minQty })),
      };
      await api.updateProduct(id!, payload);
      message.success('Product saved');
      navigate('/admin/products');
    } catch {
      message.error('Failed to save product.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error || !product) return <Alert type="error" message={error ?? 'Not found'} />;

  function updateTierRow(row: DraftTierPrice, patch: Partial<DraftTierPrice>) {
    setTierRows((prev) =>
      prev.map((r) =>
        r.sku === row.sku && r.tierId === row.tierId && r.minQty === row.minQty ? { ...r, ...patch } : r
      )
    );
  }

  // Merge each SKU's cell down over its tier rows. Precomputed by index and kept
  // pure — onCell can fire more than once per row, so it must not mutate.
  const skuRowSpans = tierRows.map((row, i) =>
    i > 0 && tierRows[i - 1].sku === row.sku
      ? 0
      : tierRows.filter((r) => r.sku === row.sku).length
  );

  const tierPriceColumns: ColumnsType<DraftTierPrice> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 170,
      render: (sku: string) => <code style={{ fontSize: 12 }}>{sku}</code>,
      onCell: (_row, index) => ({ rowSpan: skuRowSpans[index ?? 0] ?? 1 }),
    },
    {
      // Every MVP row is minQty 1, so the tag is inert today. Kept so enabling volume
      // breaks is an insert of rows, not a UI change (architecture doc §2.2.1).
      title: 'Tier',
      dataIndex: 'tierName',
      key: 'tierName',
      width: 150,
      render: (tierName: string, row) => (
        <Space size={6}>
          <span>{tierName}</span>
          {row.minQty > 1 && <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>{row.minQty}+</Tag>}
        </Space>
      ),
    },
    {
      title: 'Price', dataIndex: 'price', key: 'price', width: 130, align: 'right',
      render: (price: number, row) => (
        <InputNumber
          size="small" prefix="$" min={0} precision={2} style={{ width: '100%' }} value={price}
          // Clearing the box means "not priced", not "priced at zero".
          onChange={(v) => updateTierRow(row, { price: v ?? null })}
        />
      ),
    },
  ];

  const variantColumns: ColumnsType<Variant> = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: product.variantAxis ?? 'Variant', dataIndex: 'variantValue', key: 'variantValue',
      width: 80, align: 'right',
      render: (value: string | null, v: Variant) => value ?? v.packQuantity,
    },
    {
      // The one portal-owned field on a variant, so the one input here.
      title: 'MAP', key: 'mapPrice', width: 130, align: 'right',
      render: (_: unknown, v: Variant) => (
        <InputNumber
          prefix="$"
          size="small"
          min={0}
          precision={2}
          style={{ width: '100%' }}
          value={variantMaps[v.id] ?? undefined}
          onChange={(val) => setVariantMaps((prev) => ({ ...prev, [v.id]: val ?? null }))}
        />
      ),
    },
    { title: 'UPC', dataIndex: 'upc', key: 'upc', render: (v: string | null) => v ?? '—' },
    { title: 'Weight', dataIndex: 'weight', key: 'weight', width: 80, align: 'right', render: (v: number | null) => v ? `${v} kg` : '—' },
    {
      title: 'Supply', dataIndex: 'status', key: 'status', width: 110,
      render: (s: string) => <Tag color={s === 'ACTIVE' ? 'success' : 'default'}>{s}</Tag>,
    },
    {
      title: 'Stock (available)', key: 'stock', align: 'right', width: 130,
      render: (_: unknown, v: Variant) => v.inventory.availableStock,
    },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/products')}>
          Back to Products
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Edit Product — <code style={{ fontSize: 16 }}>{product.spuCode}</code>
        </Title>
      </Space>

      <Form form={form} layout="vertical" onFinish={onFinish}>

        {/* Sellfox-owned. Text, not disabled inputs — a greyed-out box still reads as
            "editable, just not right now". */}
        <Card
          title="Product Identity"
          size="small"
          style={{ marginBottom: 16 }}
          extra={<Tag color="default">Synced from Sellfox — overwritten on next sync</Tag>}
        >
          <Descriptions size="small" column={2} bordered items={[
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

        <Card title="Catalog Settings" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="baseWholesalePrice" label="Base Wholesale Price" rules={[{ required: true }]}>
                <InputNumber prefix="$" style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="locationCode" label="Location Code"
                tooltip="Warehouse bin. Editable until we confirm Sellfox exposes bin codes (doc §3.7.7).">
                <Input placeholder="A1-1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Visibility" rules={[{ required: true }]} tooltip="Controls dealer visibility.">
                <Select options={[
                  { value: 'VISIBLE', label: 'Visible to dealers' },
                  { value: 'HIDDEN', label: 'Hidden' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Section 2: Attributes */}
        <Card
          title="Display Attributes"
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Button size="small" icon={<PlusOutlined />}
              onClick={() => setAttrRows([...attrRows, { key: '', value: '' }])}>
              Add
            </Button>
          }
        >
          {attrRows.length === 0 && <Text type="secondary">No attributes. Click Add to create one.</Text>}
          {attrRows.map((row, i) => (
            <Space key={i} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Input
                placeholder="Key (e.g. Color)"
                value={row.key}
                style={{ width: 160 }}
                onChange={(e) => {
                  const next = [...attrRows];
                  next[i] = { ...next[i], key: e.target.value };
                  setAttrRows(next);
                }}
              />
              <Input
                placeholder="Value (e.g. Black)"
                value={row.value}
                style={{ width: 200 }}
                onChange={(e) => {
                  const next = [...attrRows];
                  next[i] = { ...next[i], value: e.target.value };
                  setAttrRows(next);
                }}
              />
              <Button
                size="small" danger icon={<DeleteOutlined />}
                onClick={() => setAttrRows(attrRows.filter((_, j) => j !== i))}
              />
            </Space>
          ))}
        </Card>

        {/* Section 3: Images */}
        <Card
          title="Images (URLs, first = primary thumbnail)"
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Button size="small" icon={<PlusOutlined />}
              onClick={() => setImageUrls([...imageUrls, ''])}>
              Add
            </Button>
          }
        >
          {imageUrls.length === 0 && <Text type="secondary">No images.</Text>}
          {imageUrls.map((url, i) => (
            <Space key={i} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Text type="secondary" style={{ width: 24, textAlign: 'right', fontSize: 12 }}>{i + 1}.</Text>
              <Input
                value={url}
                placeholder="https://..."
                style={{ width: 480 }}
                onChange={(e) => {
                  const next = [...imageUrls];
                  next[i] = e.target.value;
                  setImageUrls(next);
                }}
              />
              <Button size="small" onClick={() => {
                const next = [...imageUrls];
                if (i > 0) { [next[i - 1], next[i]] = [next[i], next[i - 1]]; setImageUrls(next); }
              }} disabled={i === 0}>↑</Button>
              <Button size="small" onClick={() => {
                const next = [...imageUrls];
                if (i < next.length - 1) { [next[i], next[i + 1]] = [next[i + 1], next[i]]; setImageUrls(next); }
              }} disabled={i === imageUrls.length - 1}>↓</Button>
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => setImageUrls(imageUrls.filter((_, j) => j !== i))} />
            </Space>
          ))}
        </Card>

        {/* Section 4: Categories */}
        <Card title="Categories" size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {categories.map((c) => (
              <Space key={c.id}>
                <Checkbox
                  checked={selectedCatIds.includes(c.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCatIds([...selectedCatIds, c.id]);
                      if (selectedCatIds.length === 0) setPrimaryCatId(c.id);
                    } else {
                      const next = selectedCatIds.filter((id) => id !== c.id);
                      setSelectedCatIds(next);
                      if (primaryCatId === c.id) setPrimaryCatId(next[0] ?? null);
                    }
                  }}
                >
                  {c.label}
                </Checkbox>
                {selectedCatIds.includes(c.id) && (
                  <Tag
                    color={primaryCatId === c.id ? 'blue' : 'default'}
                    style={{ cursor: 'pointer', fontSize: 11 }}
                    onClick={() => setPrimaryCatId(c.id)}
                  >
                    {primaryCatId === c.id ? 'Primary' : 'Set primary'}
                  </Tag>
                )}
              </Space>
            ))}
          </Space>
        </Card>

        {/* Section 5: Tier pricing — one row per SKU per tier per volume break */}
        <Card
          title="Tier Pricing"
          size="small"
          style={{ marginBottom: 16 }}
          extra={<Tag>Priced per SKU — a pack SKU's price is the whole pack</Tag>}
        >
          <Table<DraftTierPrice>
            columns={tierPriceColumns}
            dataSource={tierRows}
            rowKey={(r) => `${r.sku}:${r.tierId}:${r.minQty}`}
            size="small"
            pagination={false}
            bordered
          />
        </Card>

        <Card
          title="SKU Variants"
          size="small"
          style={{ marginBottom: 16 }}
          extra={<Tag color="default">Synced from Sellfox — except MAP, which is ours</Tag>}
        >
          <Table<Variant>
            columns={variantColumns}
            dataSource={product.variants}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </Card>

        <Divider />
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>Save Changes</Button>
          <Button onClick={() => navigate('/admin/products')}>Cancel</Button>
        </Space>
      </Form>
    </div>
  );
}
