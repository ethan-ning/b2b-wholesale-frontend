import { Link } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Space } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import type { Product } from '../api/types';
import SkuTable from './SkuTable';

const { Text, Title } = Typography;

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const primaryImage = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const totalAvailable = product.variants.reduce((s, v) => s + v.inventory.availableStock, 0);
  const hasStock = totalAvailable > 0;

  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      styles={{ body: { padding: 12 } }}
    >
      <Row gutter={12} align="top">
        {/* Thumbnail */}
        <Col flex="80px">
          <img
            src={primaryImage?.url ?? 'https://placehold.co/80x80?text=No+Image'}
            alt={primaryImage?.altText ?? product.name}
            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
          />
        </Col>

        {/* Info */}
        <Col flex="1">
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Space wrap>
              <Title level={5} style={{ margin: 0 }}>
                <Link to={`/products/${product.spuCode}`}>{product.name}</Link>
              </Title>
              {!hasStock && <Tag color="warning">Out of stock</Tag>}
            </Space>

            <Space size={16}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                SPU: <code>{product.spuCode}</code>
              </Text>
              {product.brand && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Brand: {product.brand}
                </Text>
              )}
              {product.locationCode && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <EnvironmentOutlined /> {product.locationCode}
                </Text>
              )}
            </Space>

            {product.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {product.description.length > 120
                  ? product.description.slice(0, 120) + '…'
                  : product.description}
              </Text>
            )}

            {Object.keys(product.attributes).length > 0 && (
              <Space size={8} wrap>
                {Object.entries(product.attributes).map(([k, v]) => (
                  <Text key={k} style={{ fontSize: 11 }}>
                    <Text type="secondary">{k}:</Text> {v}
                  </Text>
                ))}
              </Space>
            )}
          </Space>
        </Col>

        {/* Price */}
        <Col flex="120px" style={{ textAlign: 'right' }}>
          <Text strong style={{ fontSize: 16 }}>
            ${product.baseWholesalePrice.toFixed(2)}
          </Text>
          {product.mapPrice && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                MAP: ${product.mapPrice.toFixed(2)}
              </Text>
            </div>
          )}
        </Col>
      </Row>

      {/* SKU table inline */}
      <SkuTable variants={product.variants} variantAxis={product.variantAxis} compact />
    </Card>
  );
}
