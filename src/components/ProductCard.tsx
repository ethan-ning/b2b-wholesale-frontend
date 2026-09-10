import { Link } from 'react-router-dom';
import { Card, Typography, Tag, Space } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import type { Product } from '../api/types';
import { formatMoneyRange } from '../utils/money';
import SkuTable from './SkuTable';

const { Text } = Typography;

interface Props {
  product: Product;
}

/**
 * One product in the results list.
 *
 * A row with its SKUs laid out beneath it, not a shop tile. A dealer is deciding whether
 * to order, and that decision needs the per-SKU price and what is actually on the shelf —
 * a single "from $12.50" would send them into the detail page for every candidate before
 * they could rule any of them out. This is the difference between a trade catalogue and
 * a consumer storefront, so it is worth the vertical space.
 */
export default function ProductCard({ product }: Props) {
  const primaryImage = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const hasStock = product.variants.some((v) => v.inventory.availableStock > 0);
  const totalAvailable = product.variants.reduce((sum, v) => sum + v.inventory.availableStock, 0);
  // Price and MAP both live on the SKU, so an SPU shows a range across its variants.
  const priceRange = formatMoneyRange(product.variants.map((v) => v.tierPrice));

  return (
    <Card
      className="result-row"
      size="small"
      styles={{ body: { padding: 14 } }}
      style={{ marginBottom: 12 }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 76,
            height: 76,
            flexShrink: 0,
            borderRadius: 6,
            background: '#f2f4f7',
            border: '1px solid #eef1f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.altText ?? product.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Text type="secondary" style={{ fontSize: 10 }}>
              No image
            </Text>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/products/${product.spuCode}`}
            style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}
          >
            {product.name}
          </Link>

          <Space size={12} wrap style={{ marginTop: 4 }}>
            <Text code style={{ fontSize: 11 }}>
              {product.spuCode}
            </Text>
            {product.brand && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {product.brand}
              </Text>
            )}
            {product.locationCode && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <EnvironmentOutlined /> {product.locationCode}
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {product.variants.length} {product.variants.length === 1 ? 'SKU' : 'SKUs'}
            </Text>
            {hasStock ? (
              <Text style={{ fontSize: 12, color: '#15803d' }}>{totalAvailable} in stock</Text>
            ) : (
              <Tag color="warning" style={{ marginInlineEnd: 0, fontSize: 11 }}>
                Out of stock
              </Tag>
            )}
          </Space>
        </div>

        {/* The dealer's own price, not list price. */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="dealer-price" style={{ fontSize: 17 }}>
            {priceRange}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            your price
          </Text>
        </div>
      </div>

      <SkuTable variants={product.variants} variantAxis={product.variantAxis} compact />
    </Card>
  );
}
