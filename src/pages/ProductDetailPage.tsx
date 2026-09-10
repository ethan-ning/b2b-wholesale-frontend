import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Row,
  Col,
  Typography,
  Image,
  Tag,
  Space,
  Button,
  Divider,
  Descriptions,
  Breadcrumb,
} from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { fetchProduct } from '../api/catalog';
import { formatMoney, formatMoneyRange } from '../utils/money';
import SkuTable from '../components/SkuTable';
import { useResource } from '../hooks/useResource';
import { PageError, PageLoading } from '../components/PageState';
import { BRAND } from '../brand';

const { Title, Text } = Typography;

export default function ProductDetailPage() {
  const { spuCode } = useParams<{ spuCode: string }>();
  const { data: product, loading, error } = useResource(() => fetchProduct(spuCode!), [spuCode]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [galleryFor, setGalleryFor] = useState(spuCode);

  // Back to the first photo when the product changes: index 3 of the last product's
  // gallery is a different picture, or no picture at all, on this one. Reset during
  // render rather than from an effect, so the old index is never painted.
  if (galleryFor !== spuCode) {
    setGalleryFor(spuCode);
    setSelectedImage(0);
  }

  if (loading) return <PageLoading />;
  if (error || !product) return <PageError message={error ?? 'Product not found.'} />;

  const sortedImages = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryCategory = product.categories.find((c) => c.isPrimary) ?? product.categories[0];
  const lastSynced = product.variants[0]?.inventory.updatedAt
    ? new Date(product.variants[0].inventory.updatedAt).toLocaleString()
    : 'Unknown';

  // Headline figures are the dealer's own resolved prices, not the SPU list price.
  const lowestTierPrice = Math.min(...product.variants.map((v) => v.tierPrice));
  const mapRange = formatMoneyRange(
    product.variants.map((v) => v.mapPrice).filter((m): m is number => m !== null)
  );

  return (
    <div style={{ padding: '20px 24px 40px', maxWidth: 1160, margin: '0 auto' }}>
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
                    border: i === selectedImage ? `2px solid ${BRAND.amber}` : '2px solid #eef1f5',
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
                  Your price from
                </Text>
                <div>
                  <span className="dealer-price" style={{ fontSize: 24 }}>
                    {formatMoney(lowestTierPrice)}
                  </span>
                </div>
              </div>
              {mapRange && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    MAP price
                  </Text>
                  <div>
                    <Text style={{ fontSize: 16 }}>{mapRange}</Text>
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

      <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        SKUs & Inventory
        <Text type="secondary" style={{ fontWeight: 400, fontSize: 13, marginLeft: 12 }}>
          Last synced: {lastSynced}
        </Text>
      </Title>

      <SkuTable variants={product.variants} variantAxis={product.variantAxis} compact={false} />

      <div style={{ marginTop: 20 }}>
        <Link to="/search">
          <Button icon={<ArrowLeftOutlined />}>Back to results</Button>
        </Link>
      </div>
    </div>
  );
}
