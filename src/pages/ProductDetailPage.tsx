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
import { ArrowLeftOutlined, EnvironmentOutlined, ExpandOutlined, PictureOutlined } from '@ant-design/icons';
import { fetchProduct } from '../api/catalog';
import { formatMoney, formatMoneyRange, quotedPrices } from '../utils/money';
import SkuTable from '../components/SkuTable';
import { useResource } from '../hooks/useResource';
import { PageError, PageLoading } from '../components/PageState';

const { Title, Text } = Typography;

export default function ProductDetailPage() {
  const { spuCode } = useParams<{ spuCode: string }>();
  const { data: product, loading, error } = useResource(() => fetchProduct(spuCode!), [spuCode]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const lowestTierPrice = Math.min(...quotedPrices(product.variants));
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
          {/*
           * A local placeholder rather than a remote one. The previous fallback fetched a
           * "No Image" graphic from placehold.co, so every product without photos — most
           * of the catalogue — made a request to a third party that the page then depended
           * on. It is also kept short: full height, an empty box was the largest thing on
           * a phone screen.
           */}
          {sortedImages.length === 0 ? (
            <div className="gallery-empty">
              <PictureOutlined style={{ fontSize: 22, color: '#cbd5e1' }} />
              <Text type="secondary" style={{ fontSize: 13 }}>No image</Text>
            </div>
          ) : (
            <>
              {/*
               * A preview group, so the lightbox arrows through the whole gallery — with up
               * to nine images, opening them one at a time was nine trips back to the page.
               * Only the selected one is rendered at size; the rest are hidden members of
               * the group, so the arrows have somewhere to go.
               */}
              <div className="gallery-stage">
                <Image.PreviewGroup
                  // Controlled, so the button below can open it. `open`/`onOpenChange` are
                  // the current names; `visible`/`onVisibleChange` still work but are
                  // deprecated, and deprecated spellings are how a later upgrade breaks.
                  preview={{
                    current: selectedImage,
                    onChange: setSelectedImage,
                    open: previewOpen,
                    onOpenChange: setPreviewOpen,
                  }}
                >
                  {sortedImages.map((img, i) => (
                    <Image
                      key={img.id}
                      src={img.url}
                      alt={img.altText ?? product.name}
                      // Contain, not cover: product photography arrives at every aspect
                      // ratio, and cropping a light bar square cuts off what is being sold.
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      wrapperStyle={{ display: i === selectedImage ? 'block' : 'none', width: '100%', height: '100%' }}
                    />
                  ))}
                </Image.PreviewGroup>

                {/*
                 * Alongside antd's hover overlay rather than instead of it. That overlay
                 * only appears on hover, which a phone or tablet never sends — and this
                 * portal is used from both.
                 */}
                <button
                  type="button"
                  className="gallery-expand"
                  onClick={() => setPreviewOpen(true)}
                  aria-label="View full size"
                >
                  <ExpandOutlined /> View full size
                </button>

                {/* Says there is more to see, without needing a hover to find out. */}
                {sortedImages.length > 1 && (
                  <span className="gallery-count">{selectedImage + 1} / {sortedImages.length}</span>
                )}
              </div>

              {/*
               * Shown for a single image too. A rail of one is not much of a gallery, but a
               * product that grows a second photo should not change shape underneath the
               * dealer who already learned where to look.
               */}
              <div className="gallery-rail">
                {sortedImages.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    aria-label={`Show image ${i + 1} of ${sortedImages.length}`}
                    aria-current={i === selectedImage}
                    className={`gallery-rail__item${i === selectedImage ? ' is-selected' : ''}`}
                    onClick={() => setSelectedImage(i)}
                  >
                    <img src={img.url} alt={img.altText ?? ''} loading="lazy" />
                  </button>
                ))}
              </div>
            </>
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

      <SkuTable
        variants={product.variants}
        variantAxis={product.variantAxis}
        compact={false}
        // Always a cell here, placeholder included: on the page where a dealer compares
        // SKUs side by side, a column that comes and goes is harder to read than a blank.
        images="always"
        // Clicking a SKU's thumbnail brings its photo up top, where the size is readable.
        onPickImage={(v) => {
          const index = sortedImages.findIndex((img) => img.url === v.mainImageUrl);
          if (index >= 0) setSelectedImage(index);
        }}
      />

      <div style={{ marginTop: 20 }}>
        <Link to="/search">
          <Button icon={<ArrowLeftOutlined />}>Back to results</Button>
        </Link>
      </div>
    </div>
  );
}
