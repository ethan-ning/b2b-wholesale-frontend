import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Row,
  Col,
  Typography,
  Image,
  Tag,
  Space,
  Button,
  Spin,
  Alert,
  Divider,
  Descriptions,
  Breadcrumb,
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import client from '../api/client';
import type { Product, Variant } from '../api/types';
import SkuTable from '../components/SkuTable';

const { Title, Text } = Typography;

function exportCsv(product: Product) {
  const headers = ['SKU', product.variantAxis ?? 'Variant', 'Unit Price', 'Available Stock', 'Incoming Stock', 'UPC'];
  const rows = product.variants.map((v: Variant) => [
    v.sku,
    v.variantValue ?? v.packQuantity,
    v.tierPrice.toFixed(2),
    v.inventory.availableStock,
    v.inventory.incomingStock,
    v.upc ?? '',
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${product.spuCode}-inventory.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProductDetailPage() {
  const { spuCode } = useParams<{ spuCode: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    client
      .get<Product>(`/products/${spuCode}`)
      .then(({ data }) => {
        setProduct(data);
        setSelectedImage(0);
      })
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false));
  }, [spuCode]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ padding: 40 }}>
        <Alert type="error" message={error ?? 'Unknown error'} />
      </div>
    );
  }

  const sortedImages = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryCategory = product.categories.find((c) => c.isPrimary) ?? product.categories[0];
  const lastSynced = product.variants[0]?.inventory.updatedAt
    ? new Date(product.variants[0].inventory.updatedAt).toLocaleString()
    : 'Unknown';

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/">Home</Link> },
          { title: <Link to="/search">Products</Link> },
          ...(primaryCategory ? [{ title: primaryCategory.name }] : []),
          { title: product.name },
        ]}
      />

      <Row gutter={32}>
        {/* Image gallery */}
        <Col xs={24} md={10}>
          <Image
            src={sortedImages[selectedImage]?.url ?? 'https://placehold.co/400x300?text=No+Image'}
            alt={sortedImages[selectedImage]?.altText ?? product.name}
            style={{ width: '100%', borderRadius: 8, objectFit: 'cover' }}
          />
          {sortedImages.length > 1 && (
            <Space style={{ marginTop: 8 }} wrap>
              {sortedImages.map((img, i) => (
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.altText ?? ''}
                  onClick={() => setSelectedImage(i)}
                  style={{
                    width: 60,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: i === selectedImage ? '2px solid #1677ff' : '2px solid transparent',
                  }}
                />
              ))}
            </Space>
          )}
        </Col>

        {/* Product info */}
        <Col xs={24} md={14}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {product.name}
              </Title>
              <Space style={{ marginTop: 4 }} size={12}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  SPU: <code>{product.spuCode}</code>
                </Text>
                {product.brand && <Tag>{product.brand}</Tag>}
                {product.locationCode && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    <EnvironmentOutlined /> {product.locationCode}
                  </Text>
                )}
              </Space>
            </div>

            <Space size={24}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Wholesale price from
                </Text>
                <div>
                  <Text strong style={{ fontSize: 22 }}>
                    ${product.baseWholesalePrice.toFixed(2)}
                  </Text>
                </div>
              </div>
              {product.mapPrice && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    MAP price
                  </Text>
                  <div>
                    <Text style={{ fontSize: 16 }}>${product.mapPrice.toFixed(2)}</Text>
                  </div>
                </div>
              )}
            </Space>

            {product.description && (
              <Text style={{ fontSize: 14, color: '#555' }}>{product.description}</Text>
            )}

            {Object.keys(product.attributes).length > 0 && (
              <Descriptions
                size="small"
                column={2}
                items={Object.entries(product.attributes).map(([k, v]) => ({
                  key: k,
                  label: k.replace(/_/g, ' '),
                  children: v,
                }))}
              />
            )}
          </Space>
        </Col>
      </Row>

      <Divider />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>
          SKUs & Inventory
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 13, marginLeft: 12 }}>
            Last synced: {lastSynced}
          </Text>
        </Title>
        <Button icon={<DownloadOutlined />} size="small" onClick={() => exportCsv(product)}>
          Export CSV
        </Button>
      </div>

      <SkuTable variants={product.variants} variantAxis={product.variantAxis} compact={false} />

      <div style={{ marginTop: 20 }}>
        <Link to="/search">
          <Button icon={<ArrowLeftOutlined />}>Back to results</Button>
        </Link>
      </div>
    </div>
  );
}
