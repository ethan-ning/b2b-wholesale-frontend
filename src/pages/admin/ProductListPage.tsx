import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Button, Space, Tag, Typography, Popconfirm, message } from 'antd';
import { EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type { Product } from '../../api/types';
import { usePagedQuery } from '../../hooks/usePagedQuery';

const { Title } = Typography;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];

/** The backend caps a page at 200 (domain Page.MAX_SIZE), so these stay well inside it. */
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = ['20', '50', '100'];

/** The catalog's natural order, and what the API sorts by when asked for nothing. */
const DEFAULT_SORT = { field: 'spuCode', direction: 'asc' } as const;

type SortState = { field: string; direction: 'asc' | 'desc' };

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'success',
  DRAFT: 'default',
  ARCHIVED: 'error',
};

export default function ProductListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  // pageSize sits in the filters rather than beside them, so changing it returns to the
  // first page — page 3 of 10-per-page is out of range at 100 per page.
  const { data, loading, page, setPage, reload } = usePagedQuery(
    (f, p) => api.fetchProducts({ ...f, page: p }),
    { search, status: statusFilter, size: pageSize, sort: sort.field, direction: sort.direction }
  );

  async function handleDelete(id: number) {
    await api.deleteProduct(id);
    message.success('Product deleted');
    reload();
  }

  /** antd's order values; the API takes asc/desc, so the two are mapped at the boundary. */
  const orderFor = (field: string) =>
    sort.field === field ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null;

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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_: unknown, r: Product) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/products/${r.id}/edit`)}
          />
          <Popconfirm
            title="Delete this product?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(r.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
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
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 140 }}
          />
        </Space>
      </div>

      <Table<Product>
        columns={columns}
        dataSource={data?.content ?? []}
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
