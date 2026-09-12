import { useEffect, useState } from 'react';
import { Button, Empty, Input, Modal, Pagination, Popconfirm, Select, Space, Spin, Table, Tag, Typography, Upload, message } from 'antd';
import { DeleteOutlined, PictureOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import * as api from '../../api/adminApi';
import { apiErrorMessage } from '../../api/http';
import { DEFAULT_PAGE_SIZE } from '../listPagination';
import type { ImageLibraryPage, ImageUsage, ProductImage, Variant } from '../../api/types';

const { Text } = Typography;

/** Mirrors ImageRules.MAX_PER_PRODUCT. The API is the authority; this only shows the count. */
const MAX_IMAGES = 9;

/**
 * A product's gallery, and which image stands for each SKU.
 *
 * Everything here saves as it is done, unlike the rest of the product form: attaching a
 * file and reordering a gallery are single acts, and holding them in a draft to be
 * committed later would mean an upload that exists in the bucket but not on the product
 * until someone remembers to press Save.
 */
export default function ProductGallery({ productId, images: initial, variants, variantAxis }: {
  productId: number;
  images: ProductImage[];
  variants: Variant[];
  variantAxis: string | null;
}) {
  const [images, setImages] = useState<ProductImage[]>(
    () => [...initial].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [mainImages, setMainImages] = useState<Record<number, number | null>>(
    () => Object.fromEntries(variants.map((v) => [v.id, v.mainImageId]))
  );
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const full = images.length >= MAX_IMAGES;

  /** Runs one API call, reports whatever it refused with, and reports nothing on success. */
  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    try {
      await action();
    } catch (e: unknown) {
      message.error(apiErrorMessage(e, fallback));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    try {
      let created: { id: number; url: string; altText: string | null } | null = null;
      await run(async () => {
        const image = await api.uploadImage(file);
        await api.attachImage(productId, image.id);
        created = image;
      }, 'Could not upload that image.');
      if (created) {
        const img = created as { id: number; url: string; altText: string | null };
        setImages((current) => [
          ...current,
          { id: img.id, url: img.url, altText: img.altText, sortOrder: current.length },
        ]);
        message.success('Image added');
      }
    } catch {
      // Already reported. Swallowed so a refused upload does not reach the console as unhandled.
    }
  }

  async function attach(image: ImageUsage['image']) {
    try {
      await run(() => api.attachImage(productId, image.id), 'Could not add that image.');
      setImages((current) => [
        ...current,
        { id: image.id, url: image.url, altText: image.altText, sortOrder: current.length },
      ]);
    } catch { /* reported */ }
  }

  /**
   * Detaching also gives up being any SKU's main image — the API does that, and the
   * picker has to agree or it would go on naming an image the product no longer shows.
   */
  async function detach(imageId: number) {
    try {
      await run(() => api.detachImage(productId, imageId), 'Could not remove that image.');
      setImages((current) => current.filter((i) => i.id !== imageId));
      setMainImages((current) =>
        Object.fromEntries(
          Object.entries(current).map(([v, id]) => [v, id === imageId ? null : id])
        )
      );
    } catch { /* reported */ }
  }

  async function move(index: number, by: -1 | 1) {
    const next = [...images];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    const before = images;
    setImages(next);
    try {
      await run(() => api.reorderImages(productId, next.map((i) => i.id)), 'Could not reorder.');
    } catch {
      setImages(before);
    }
  }

  async function setMain(variantId: number, imageId: number | null) {
    const before = mainImages[variantId] ?? null;
    setMainImages((current) => ({ ...current, [variantId]: imageId }));
    try {
      await run(() => api.setMainImage(productId, variantId, imageId), 'Could not set the main image.');
    } catch {
      setMainImages((current) => ({ ...current, [variantId]: before }));
    }
  }

  const options = images.map((image, index) => ({
    value: image.id,
    label: `${index + 1}. ${image.altText ?? 'Image'}`,
    url: image.url,
  }));

  return (
    <Spin spinning={busy}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          Gallery{' '}
          <Text type="secondary" style={{ fontWeight: 400 }}>
            — {images.length} of {MAX_IMAGES}; saves as you go
          </Text>
        </Text>
        <Space>
          <Button size="small" icon={<PlusOutlined />} disabled={full} onClick={() => setPicking(true)}>
            Add from library
          </Button>
          <Upload
            showUploadList={false}
            accept="image/jpeg,image/png,image/webp"
            beforeUpload={(file) => {
              void upload(file as unknown as File);
              // Handled here; antd's own uploader would post to a URL we never gave it.
              return false;
            }}
          >
            <Button size="small" type="primary" icon={<UploadOutlined />} disabled={full}>
              Upload
            </Button>
          </Upload>
        </Space>
      </div>

      {full && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          At the limit. Remove one before adding another.
        </Text>
      )}

      {images.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No images on this product yet."
          style={{ margin: '12px 0' }}
        />
      ) : (
        <div className="gallery-grid">
          {images.map((image, index) => (
            <figure key={image.id} className="gallery-tile">
              <img src={image.url} alt={image.altText ?? ''} loading="lazy" />
              <figcaption>
                {/* Position 1 is what a dealer sees on a product that has no per-SKU choice. */}
                {index === 0 ? <Tag color="blue">Cover</Tag> : <span className="gallery-tile__n">{index + 1}</span>}
                <Space size={2}>
                  <Button size="small" disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
                  <Button size="small" disabled={index === images.length - 1} onClick={() => move(index, 1)}>↓</Button>
                  <Popconfirm
                    title="Remove from this product?"
                    description="The file stays in the library."
                    okText="Remove"
                    onConfirm={() => detach(image.id)}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`Remove image ${index + 1} from this product`}
                    />
                  </Popconfirm>
                </Space>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Text strong style={{ fontSize: 13, display: 'block', margin: '16px 0 8px' }}>
        Main image per SKU{' '}
        <Text type="secondary" style={{ fontWeight: 400 }}>
          — one image from the gallery above, shown in dealer search results
        </Text>
      </Text>
      <Table<Variant>
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={variants}
        columns={[
          { title: 'SKU', dataIndex: 'sku', render: (sku: string) => <code>{sku}</code> },
          { title: variantAxis ?? 'Variant', dataIndex: 'variantValue', render: (v: string | null) => v ?? '—' },
          {
            title: 'Main image',
            key: 'main',
            width: 320,
            render: (_, variant) => {
              const chosen = mainImages[variant.id] ?? null;
              const preview = images.find((i) => i.id === chosen);
              return (
                <Space>
                  {preview
                    ? <img src={preview.url} alt="" className="gallery-chip" />
                    : <span className="gallery-chip gallery-chip--empty"><PictureOutlined /></span>}
                  <Select
                    size="small"
                    aria-label={`Main image for ${variant.sku}`}
                    style={{ width: 220 }}
                    value={chosen}
                    placeholder="None"
                    allowClear
                    disabled={images.length === 0}
                    options={options}
                    onChange={(value) => setMain(variant.id, value ?? null)}
                  />
                </Space>
              );
            },
          },
        ]}
      />

      <LibraryPicker
        open={picking}
        attached={images.map((i) => i.id)}
        onPick={async (image) => { setPicking(false); await attach(image); }}
        onClose={() => setPicking(false)}
      />
    </Spin>
  );
}

/**
 * The library, minus what this product already shows — re-adding is not a thing it can do.
 *
 * Searched and paged against the API rather than filtered here. The catalogue runs to
 * hundreds of pictures, so a modal holding one page of them and no way to search would
 * put most of the library out of reach.
 */
function LibraryPicker({ open, attached, onPick, onClose }: {
  open: boolean;
  attached: number[];
  onPick: (image: ImageUsage['image']) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ImageLibraryPage | null>(null);
  const [loading, setLoading] = useState(false);

  // Reopening starts clean. Done during render rather than from an effect, the way the
  // rest of this app resets on a changed input: from an effect it is a second render,
  // and for one frame the modal shows the last search's results as though they were new.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setSearch(''); setPage(0); setResult(null); }
  }

  const request = open ? `${search}|${page}` : null;
  const [requested, setRequested] = useState(request);
  if (request !== requested) {
    setRequested(request);
    setLoading(open);
  }

  useEffect(() => {
    if (!open) return;
    let current = true;
    api.fetchImageLibrary({ search, page })
      .then((r) => { if (current) setResult(r); })
      .catch((e: unknown) => {
        if (current) message.error(apiErrorMessage(e, 'Could not load the image library.'));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open, search, page]);

  // Filtered after fetching, so a page can come back short. Saying so is better than
  // leaving someone to wonder why a page of 24 shows 21.
  const available = (result?.content ?? []).filter((row) => !attached.includes(row.image.id));

  return (
    <Modal title="Add from library" open={open} onCancel={onClose} footer={null} width={760}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Filename, SPU or product name"
        style={{ marginBottom: 12 }}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
      />
      <Spin spinning={loading}>
        {available.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={result?.totalElements
              ? 'Nothing here this product does not already show.'
              : 'No images match.'}
          />
        ) : (
          <div className="gallery-grid">
            {available.map((row) => (
              <figure key={row.image.id} className="gallery-tile gallery-tile--pick">
                <img src={row.image.url} alt={row.image.altText ?? ''} loading="lazy" />
                <figcaption>
                  <span className="gallery-tile__name" title={row.image.filename}>{row.image.filename}</span>
                  <Button size="small" type="primary" onClick={() => onPick(row.image)}>Add</Button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {(result?.totalElements ?? 0) > 0 && (
          <Pagination
            size="small"
            align="end"
            style={{ marginTop: 12 }}
            current={page + 1}
            pageSize={DEFAULT_PAGE_SIZE}
            total={result?.totalElements ?? 0}
            showSizeChanger={false}
            onChange={(p) => setPage(p - 1)}
            showTotal={(t) => `${t} in the library`}
          />
        )}
      </Spin>
    </Modal>
  );
}
