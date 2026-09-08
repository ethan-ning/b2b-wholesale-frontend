import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Button, Space, Tag, Typography, Popconfirm, message } from 'antd';
import { EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import adminClient from '../../api/adminClient';
import type { AdminProduct, PagedResult } from '../../api/types';

const { Title } = Typography;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'success',
  DRAFT: 'default',
  ARCHIVED: 'error',
};

export default function ProductListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PagedResult<AdminProduct> | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), size: '10' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await adminClient.get<PagedResult<AdminProduct>>('/admin/products', { params });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  async function handleDelete(id: number) {
    await adminClient.delete(`/admin/products/${id}`);
    message.success('Product deleted');
    fetchProducts();
  }

  const columns: ColumnsType<AdminProduct> = [
    {
      title: 'SPU Code',
      dataIndex: 'spuCode',
      key: 'spuCode',
      width: 140,
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Brand', dataIndex: 'brand', key: 'brand', width: 100, render: (v: string | null) => v ?? '—' },
    {
      title: 'Base Price',
      dataIndex: 'baseWholesalePrice',
      key: 'price',
      width: 100,
      align: 'right',
      render: (v: number) => `$${v.toFixed(2)}`,
    },
    {
      title: 'SKUs',
      key: 'variants',
      width: 60,
      align: 'right',
      render: (_: unknown, r: AdminProduct) => r.variants.length,
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
      render: (_: unknown, r: AdminProduct) => (
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

      <Table<AdminProduct>
        columns={columns}
        dataSource={data?.content ?? []}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page + 1,
          total: data?.totalElements ?? 0,
          pageSize: 10,
          onChange: (p) => setPage(p - 1),
          showTotal: (t) => `${t} products`,
        }}
        size="small"
      />
    </div>
  );
}
