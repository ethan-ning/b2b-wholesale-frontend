import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Checkbox, Input, Popconfirm, Space, Table, Tag, Typography, Upload, message } from 'antd';
import { DeleteOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import { apiErrorMessage } from '../../api/http';
import { PageError } from '../../components/PageState';
import PageHeader from '../../components/admin/PageHeader';
import { useDebounced } from '../../hooks/useDebounced';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import type { ImageLibraryPage, ImageUsage } from '../../api/types';

const { Text } = Typography;

/** Bytes as an admin reads them. Null when the API did not record a size. */
function fileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Every image in the catalog, and what is keeping each one alive.
 *
 * The point of the screen is the "used by" column: an image can only be deleted once no
 * product shows it, and without somewhere to see that, finding the last product holding
 * a file means opening products one at a time.
 *
 * Paged and searched by the API. Both used to happen here over the whole library, which
 * meant the first paint waited on every row in the catalogue.
 */
export default function ImageListPage() {
  const [search, setSearch] = useState('');
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [uploading, setUploading] = useState(false);

  // The box updates as it is typed into; the API is asked once the typing stops. The
  // checkbox is not debounced — one click is one question, and waiting on it feels broken.
  const settledSearch = useDebounced(search);

  const { data, loading, error, page, setPage, reload } = usePagedQuery(
    (filters, p) => api.fetchImageLibrary({ ...filters, page: p }),
    { search: settledSearch, unusedOnly },
  );
  const library = data as ImageLibraryPage | null;

  async function upload(file: File) {
    setUploading(true);
    try {
      await api.uploadImage(file);
      message.success(`${file.name} uploaded`);
      reload();
    } catch (e: unknown) {
      message.error(apiErrorMessage(e, 'Could not upload that image.'));
    } finally {
      setUploading(false);
    }
  }

  async function remove(row: ImageUsage) {
    try {
      await api.deleteImage(row.image.id);
      message.success(`${row.image.filename} deleted`);
      reload();
    } catch (e: unknown) {
      // Verbatim: the API's refusal names the products still showing it.
      message.error(apiErrorMessage(e, 'Could not delete that image.'));
    }
  }

  /*
   * Widths are declared, and the table is laid out from them rather than from whatever
   * this page's rows happen to contain. Left to size itself, every column shifted on each
   * page change — a filename one row longer moved the whole table. The one column without
   * a width takes the remainder, so it still follows the window.
   */
  const columns: ColumnsType<ImageUsage> = [
    {
      title: '',
      key: 'thumb',
      width: 72,
      render: (_, row) => (
        <a href={row.image.url} target="_blank" rel="noreferrer">
          <img src={row.image.url} alt={row.image.altText ?? ''} className="gallery-chip" style={{ width: 48, height: 48 }} />
        </a>
      ),
    },
    {
      title: 'File',
      key: 'filename',
      render: (_, row) => (
        <div>
          {/* Wraps rather than ellipsing: the name is how these are told apart. */}
          <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{row.image.filename}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.image.width && row.image.height ? `${row.image.width}×${row.image.height}` : 'size unknown'}
            {row.image.stored ? '' : ' · external link'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Size',
      key: 'bytes',
      width: 90,
      align: 'right',
      render: (_, row) => <Text type="secondary" style={{ fontSize: 12 }}>{fileSize(row.image.bytes)}</Text>,
    },
    {
      title: 'Used by',
      key: 'usedBy',
      width: 320,
      render: (_, row) =>
        row.usedBy.length === 0 ? (
          <Tag color="default">Unused</Tag>
        ) : (
          <Space size={[4, 4]} wrap>
            {row.usedBy.map((u) => (
              <Link key={u.productId} to={`/admin/products/${u.productId}/edit`}>
                <Tag color="blue" style={{ cursor: 'pointer' }} title={u.name}>{u.spuCode}</Tag>
              </Link>
            ))}
          </Space>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, row) =>
        row.deletable ? (
          <Popconfirm
            title="Delete this image?"
            description="The file is removed from storage. This cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(row)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        ) : (
          // Disabled rather than hidden, so the reason is visible where the action would be.
          <Button size="small" disabled icon={<DeleteOutlined />} title="Remove it from every product first">
            Delete
          </Button>
        ),
    },
  ];

  if (error) return <PageError message="Failed to load the image library." />;

  return (
    <div>
      <PageHeader
        title="Images"
        subtitle="Every image in the catalog. An image can only be deleted once no product shows it."
        actions={
          <Upload
            showUploadList={false}
            accept="image/jpeg,image/png,image/webp"
            beforeUpload={(file) => { void upload(file as unknown as File); return false; }}
          >
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}>Upload image</Button>
          </Upload>
        }
      />

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Filename, SPU or product name"
            style={{ width: 320 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Checkbox checked={unusedOnly} onChange={(e) => setUnusedOnly(e.target.checked)}>
            Unused only ({library?.unusedCount ?? 0})
          </Checkbox>
          <Text type="secondary" style={{ fontSize: 12 }}>
            An image is attached from a product's own page. Upload here to have it ready first.
          </Text>
        </Space>
      </Card>

      <Table<ImageUsage>
        rowKey={(row) => row.image.id}
        size="small"
        // Laid out from the declared widths, so a column keeps its place between pages.
        tableLayout="fixed"
        columns={columns}
        dataSource={library?.content ?? []}
        loading={loading}
        pagination={{
          current: page + 1,
          pageSize: api.IMAGE_PAGE_SIZE,
          total: library?.totalElements ?? 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p - 1),
          showTotal: (t) => `${t} images`,
        }}
        locale={{ emptyText: search || unusedOnly ? 'No images match.' : 'No images yet.' }}
      />
    </div>
  );
}
