import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Button, Space, Tag, Typography, Popconfirm, message, Tooltip } from 'antd';
import { EditOutlined, EyeInvisibleOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type { Product } from '../../api/types';
import { usePagedQuery } from '../../hooks/usePagedQuery';

const { Title } = Typography;

const VISIBILITY_OPTIONS = [
  { value: '', label: 'All products' },
  { value: 'VISIBLE', label: 'Visible' },
  { value: 'HIDDEN', label: 'Hidden' },
];

/**
 * Its own filter rather than another entry in the visibility one — a product is hidden
 * *because* it is unpriced, so the two would otherwise be askable in contradiction.
 *
 * Applied to the page in hand, not by the API: it narrows what you are looking at, but
 * the count and the pager still describe the unfiltered result. Enough to work through a
 * page; if it needs to answer "how many are still unpriced", that has to move server-side.
 */
const PRICING_OPTIONS = [
  { value: '', label: 'Any pricing' },
  { value: 'unpriced', label: 'Unpriced only' },
  { value: 'priced', label: 'Priced only' },
];

/** The backend caps a page at 200 (domain Page.MAX_SIZE), so these stay well inside it. */
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = ['20', '50', '100'];

/** The catalog's natural order, and what the API sorts by when asked for nothing. */
const DEFAULT_SORT = { field: 'spuCode', direction: 'asc' } as const;

type SortState = { field: string; direction: 'asc' | 'desc' };

const VISIBILITY_COLORS: Record<string, string> = {
  VISIBLE: 'green',
  HIDDEN: 'default',
};

export default function ProductListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [pricingFilter, setPricingFilter] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  // pageSize sits in the filters rather than beside them, so changing it returns to the
  // first page — page 3 of 10-per-page is out of range at 100 per page.
  const { data, loading, page, setPage, reload } = usePagedQuery(
    (f, p) => api.fetchProducts({ ...f, page: p }),
    { search, visibility: visibilityFilter, size: pageSize, sort: sort.field, direction: sort.direction }
  );

  async function setActive(product: Product, active: boolean) {
    try {
      await api.setProductActive(product.id, active);
      message.success(
        active ? `${product.spuCode} is visible to dealers` : `${product.spuCode} is hidden from dealers`,
      );
      reload();
    } catch (e: unknown) {
      // Surfaced verbatim: the API's refusal names the SPU and says what to do about it.
      const detail = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(detail ?? 'Could not change visibility.');
    }
  }

  /** antd's order values; the API takes asc/desc, so the two are mapped at the boundary. */
  const orderFor = (field: string) =>
    sort.field === field ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null;

  const rows = (data?.content ?? []).filter((p) => {
    if (pricingFilter === 'unpriced') return p.sellable === false;
    if (pricingFilter === 'priced') return p.sellable !== false;
    return true;
  });

  const columns: ColumnsType<Product> = [
    {
      title: 'SPU',
      dataIndex: 'spuCode',
      key: 'spuCode',
      width: 130,
      // Sorting is done by the API over the whole result set, not by antd over the
      // current page — sorting one page of 24 products would order only those rows.
      sorter: true,
      sortOrder: orderFor('spuCode'),
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
      sorter: true,
      sortOrder: orderFor('brand'),
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Base Price',
      dataIndex: 'baseWholesalePrice',
      key: 'price',
      // Wide enough for the label and the sort arrow side by side; at 100 the header
      // wrapped onto two lines and pushed the row height around.
      width: 140,
      align: 'right',
      sorter: true,
      sortOrder: orderFor('price'),
      render: (v: number) => `$${v.toFixed(2)}`,
    },
    {
      title: 'SKUs',
      key: 'variants',
      width: 60,
      align: 'right',
      render: (_: unknown, r: Product) => r.variants.length,
    },
    {
      title: 'Visibility',
      key: 'visibility',
      width: 150,
      render: (_: unknown, r: Product) => (
        <Space size={4} wrap>
          <Tag color={VISIBILITY_COLORS[r.visibility] ?? 'default'}>{r.visibility}</Tag>
          {/* Says why it is inactive. Without this, a product imported five minutes ago
              and one an admin hid on purpose look identical. */}
          {r.sellable === false && (
            <Tooltip title="No tier pricing yet, so it cannot be shown to dealers">
              <Tag color="orange">Unpriced</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: unknown, r: Product) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            title="Edit"
            onClick={() => navigate(`/admin/products/${r.id}/edit`)}
          />
          {r.visibility !== 'VISIBLE' && r.sellable === false ? (
            <Tooltip title="Set tier pricing for every SKU before this can go live">
              {/* A disabled button swallows hover, so the tooltip needs a wrapper. */}
              <span>
                <Button size="small" type="primary" ghost disabled icon={<EyeOutlined />} />
              </span>
            </Tooltip>
          ) : r.visibility === 'VISIBLE' ? (
            <Popconfirm
              title="Hide from dealers?"
              description="The product and its pricing are kept. You can make it visible again at any time."
              onConfirm={() => setActive(r, false)}
              okText="Hide"
            >
              <Button size="small" icon={<EyeInvisibleOutlined />} title="Hide from dealers" />
            </Popconfirm>
          ) : (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<EyeOutlined />}
              title="Make visible to dealers"
              onClick={() => setActive(r, true)}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Products</Title>
        <Space>
          <Input
            placeholder="Search name or SPU code..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            value={visibilityFilter}
            options={VISIBILITY_OPTIONS}
            onChange={(v) => setVisibilityFilter(v)}
            style={{ width: 140 }}
          />
          <Select
            value={pricingFilter}
            options={PRICING_OPTIONS}
            onChange={(v) => setPricingFilter(v)}
            style={{ width: 140 }}
          />
        </Space>
      </div>

      <Table<Product>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        onChange={(_pagination, _filters, sorter) => {
          // Clearing a sort (antd's third click) returns to the catalog's natural order
          // rather than to whatever the database happens to yield.
          const s = Array.isArray(sorter) ? sorter[0] : sorter;
          if (!s?.order) setSort(DEFAULT_SORT);
          else setSort({ field: String(s.columnKey), direction: s.order === 'ascend' ? 'asc' : 'desc' });
        }}
        pagination={{
          current: page + 1,
          total: data?.totalElements ?? 0,
          pageSize,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: (p, size) => {
            // antd reports both together; only one of them actually changed.
            if (size !== pageSize) setPageSize(size);
            else setPage(p - 1);
          },
          showTotal: (t, [from, to]) => `${from}-${to} of ${t} products`,
        }}
        size="small"
      />
    </div>
  );
}
