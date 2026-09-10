import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form, Input, InputNumber, Select, Button, Card, Typography, Space,
  Divider, Tag, message, Row, Col, Descriptions,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import * as api from '../../api/adminApi';
import { PageError, PageLoading } from '../../components/PageState';
import SkuPricingTable, { buildSkuRows } from '../../components/admin/SkuPricingTable';
import CategoryPicker, { flattenCategories } from '../../components/admin/CategoryPicker';
import type { FlatCategory } from '../../components/admin/CategoryPicker';
import type { SkuRow } from '../../components/admin/SkuPricingTable';
import type { CustomerTier, Product, Variant, WarehouseStock } from '../../api/types';

const { Title, Text } = Typography;

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [primaryCatId, setPrimaryCatId] = useState<number | null>(null);
  // Per-SKU MAP, keyed by variant id — the only place MAP is edited.
  const [variantMaps, setVariantMaps] = useState<Record<number, number | null>>({});
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);
  const [stock, setStock] = useState<WarehouseStock[]>([]);

  useEffect(() => {
    Promise.all([api.fetchProduct(id!), api.fetchCategories(), api.fetchTiers()])
      .then(([detail, cats, tiers]) => {
        // The price book and the stock breakdown are siblings of the product, not fields on it.
        const p = detail.product;
        setProduct(p);
        setAttrRows(Object.entries(p.attributes).map(([k, v]) => ({ key: k, value: v })));
        setImageUrls(
          [...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url)
        );
        setVariantMaps(Object.fromEntries(p.variants.map((v) => [v.id!, v.mapPrice])));
        setSkuRows(buildSkuRows(p.variants, tiers, detail.tierPrices));
        setStock(detail.stockByWarehouse ?? []);
        const catIds = p.categories.map((c) => c.id);
        setSelectedCatIds(catIds);
        setPrimaryCatId(p.categories.find((c) => c.isPrimary)?.id ?? catIds[0] ?? null);
        setCategories(flattenCategories(cats));
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
          product!.variants.map((v: Variant) => [v.id!, variantMaps[v.id!] ?? null])
        ),
        // Only the rows someone actually filled in — a blank is not a zero.
        tierPrices: skuRows
          .filter((r): r is SkuRow & { tier: CustomerTier; price: number } => r.tier !== null && r.price !== null)
          .map((r) => ({ sku: r.variant.sku, tierId: r.tier.id, price: r.price, minQty: r.minQty })),
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

  if (loading) return <PageLoading />;
  if (error || !product) return <PageError message={error ?? 'Product not found.'} />;

  function updatePrice(row: SkuRow, price: number | null) {
    setSkuRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, price } : r)));
  }

  function toggleCategory(catId: number, checked: boolean) {
    if (checked) {
      setSelectedCatIds([...new Set([...selectedCatIds, catId])]);
      // First one in takes the primary slot. Silent while it is the only candidate; once a
      // second category arrives the control appears already pointing at this one.
      if (primaryCatId === null) setPrimaryCatId(catId);
      return;
    }
    const next = selectedCatIds.filter((x) => x !== catId);
    setSelectedCatIds(next);
    if (primaryCatId === catId) setPrimaryCatId(next[0] ?? null);
  }

  return (
    <div style={{ maxWidth: 1240 }}>
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
              <Form.Item name="baseWholesalePrice" label="Base Wholesale Price" rules={[{ required: true }]}
                tooltip="List price for one unit. Only reached when a SKU has no tier price at all.">
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
              <Form.Item name="status" label="Visibility" rules={[{ required: true }]}
                tooltip="A product cannot be made visible until every SKU still on sale has a tier price.">
                <Select options={[
                  { value: 'VISIBLE', label: 'Visible to dealers' },
                  { value: 'HIDDEN', label: 'Hidden' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          title="SKUs, Pricing & Stock"
          size="small"
          style={{ marginBottom: 16 }}
          extra={<Tag color="default">Prices and MAP are ours — everything else is Sellfox's</Tag>}
        >
          <SkuPricingTable
            rows={skuRows}
            variantAxis={product.variantAxis}
            stock={stock}
            mapPrices={variantMaps}
            onPrice={updatePrice}
            onMapPrice={(variantId, price) =>
              setVariantMaps((prev) => ({ ...prev, [variantId]: price }))}
          />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            A pack SKU's price is for the whole pack, not one of its contents.
          </Text>
        </Card>

        <CategoryPicker
          categories={categories}
          selectedIds={selectedCatIds}
          primaryId={primaryCatId}
          onToggle={toggleCategory}
          onPrimary={setPrimaryCatId}
        />

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

        <Divider />
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>Save Changes</Button>
          <Button onClick={() => navigate('/admin/products')}>Cancel</Button>
        </Space>
      </Form>
    </div>
  );
}
