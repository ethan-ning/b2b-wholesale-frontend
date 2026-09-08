import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form, Input, InputNumber, Select, Button, Card, Typography, Space, Table,
  Spin, Alert, Divider, Tag, message, Checkbox, Row, Col,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import adminClient from '../../api/adminClient';
import type { AdminProduct, Category, Variant, TierPrice } from '../../api/types';

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

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [product, setProduct] = useState<AdminProduct | null>(null);
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
  // Per-SKU MAP, keyed by variant id. The only place MAP is edited — there is no
  // SPU-level MAP to inherit from.
  const [variantMaps, setVariantMaps] = useState<Record<number, number | null>>({});
  // tier_price rows for this SPU's SKUs, sorted SKU-first by the API.
  const [tierRows, setTierRows] = useState<TierPrice[]>([]);

  useEffect(() => {
    Promise.all([
      adminClient.get<AdminProduct>(`/admin/products/${id}`),
      adminClient.get<Category[]>('/admin/categories'),
    ])
      .then(([pRes, cRes]) => {
        const p = pRes.data;
        setProduct(p);
        setAttrRows(Object.entries(p.attributes).map(([k, v]) => ({ key: k, value: v })));
        setImageUrls(
          [...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url)
        );
        setVariantMaps(Object.fromEntries(p.variants.map((v) => [v.id, v.mapPrice])));
        setTierRows(p.tierPrices);
        const catIds = p.categories.map((c) => c.id);
        setSelectedCatIds(catIds);
        setPrimaryCatId(p.categories.find((c) => c.isPrimary)?.id ?? catIds[0] ?? null);
        setCategories(flattenCats(cRes.data));
        form.setFieldsValue({
          name: p.name,
          brand: p.brand,
          description: p.description,
          baseWholesalePrice: p.baseWholesalePrice,
          locationCode: p.locationCode,
          status: p.status,
        });
      })
      .catch(() => setError('Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id, form]);

  async function onFinish(values: {
    name: string; brand: string; description: string;
    baseWholesalePrice: number;
    locationCode: string; status: string;
  }) {
    setSaving(true);
    try {
      const payload = {
        ...values,
        attributes: Object.fromEntries(attrRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])),
        images: imageUrls.map((url, i) => ({ url, altText: null, sortOrder: i })),
        categories: selectedCatIds.map((cid) => ({
          id: cid,
          name: categories.find((c) => c.id === cid)?.label ?? '',
          isPrimary: cid === primaryCatId,
        })),
        // Variants are otherwise read-only (synced from Sellfox), but MAP is ours.
        variants: product!.variants.map((v) => ({ ...v, mapPrice: variantMaps[v.id] ?? null })),
        tierPrices: tierRows,
      };
      await adminClient.put(`/admin/products/${id}`, payload);
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

  function updateTierRow(row: TierPrice, patch: Partial<TierPrice>) {
    setTierRows((prev) =>
      prev.map((r) =>
        r.sku === row.sku && r.tierId === row.tierId && r.minQty === row.minQty ? { ...r, ...patch } : r
      )
    );
  }

  // Rows arrive sorted by SKU, so merge each SKU's cell down over its tier rows — the
  // grouping is the point: every price belongs to one SKU. Precomputed by index and
  // kept pure; onCell can fire more than once per row, so it must not mutate.
  const skuRowSpans = tierRows.map((row, i) =>
    i > 0 && tierRows[i - 1].sku === row.sku
      ? 0
      : tierRows.filter((r) => r.sku === row.sku).length
  );

  const tierPriceColumns: ColumnsType<TierPrice> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 170,
      render: (sku: string) => <code style={{ fontSize: 12 }}>{sku}</code>,
      onCell: (_row, index) => ({ rowSpan: skuRowSpans[index ?? 0] ?? 1 }),
    },
    {
      // Every MVP row is minQty 1, so the tag never renders today. Kept so that
      // switching quantity-based pricing on is an insert of rows, not a UI change —
      // break rows would show as "Gold 6+" beside their base row automatically.
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
          onChange={(v) => updateTierRow(row, { price: v ?? 0 })}
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
      // Editable: MAP is set per SKU. On a pack SKU this is the whole pack's
      // advertised price, matching how the dealer-facing table reads it.
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
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
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

        {/* Section 1: Basic info */}
        <Card title="Basic Info" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="brand" label="Brand">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="baseWholesalePrice" label="Base Wholesale Price" rules={[{ required: true }]}>
                <InputNumber prefix="$" style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            {/* No SPU-level MAP — it is set per SKU in the Variants section below,
                since a pack SKU's MAP scales with its quantity. */}
            <Col span={8}>
              <Form.Item name="locationCode" label="Location Code">
                <Input placeholder="A1-1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'ARCHIVED', label: 'Archived' },
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
          <Table<TierPrice>
            columns={tierPriceColumns}
            dataSource={tierRows}
            rowKey={(r) => `${r.sku}:${r.tierId}:${r.minQty}`}
            size="small"
            pagination={false}
            bordered
          />
        </Card>

        {/* Section 6: Variants (read-only, synced from Sellfox) */}
        <Card
          title="SKU Variants"
          size="small"
          style={{ marginBottom: 16 }}
          extra={<Tag>Synced from Sellfox — read only</Tag>}
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
