import { useState } from 'react';
import { Table, Input, Checkbox, Typography, Space, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type { SkuStock } from '../../api/types';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { StockBadge } from '../../components/StockBadge';

const { Title } = Typography;

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data, loading, page, setPage } = usePagedQuery(
    (f, p) => api.fetchInventory({ ...f, page: p }),
    { search, lowStockOnly }
  );

  const columns: ColumnsType<SkuStock> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    { title: 'Product', dataIndex: 'productName', key: 'product', ellipsis: true },
    {
      title: 'SPU Code',
      dataIndex: 'spuCode',
      key: 'spuCode',
      width: 130,
      render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code>,
    },
    {
      title: 'Available',
      dataIndex: 'availableStock',
      key: 'available',
      width: 100,
      align: 'right',
      render: (v: number, row: SkuStock) => <StockBadge qty={v} low={row.lowStock} />,
    },
    {
      title: 'Incoming',
      dataIndex: 'incomingStock',
      key: 'incoming',
      width: 90,
      align: 'right',
      render: (v: number) =>
        v > 0 ? <span style={{ color: '#1677ff' }}>+{v}</span> : <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Variant',
      dataIndex: 'variantValue',
      key: 'variantValue',
      width: 90,
      align: 'right',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'State',
      key: 'state',
      width: 120,
      render: (_: unknown, row: SkuStock) =>
        row.outOfStock ? <Tag color="red">Out of stock</Tag>
          : row.lowStock ? <Tag color="orange">Low</Tag>
          : <Tag color="green">OK</Tag>,
    },
    {
      title: 'Last Synced',
      dataIndex: 'lastSyncedAt',
      key: 'lastSyncedAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Inventory</Title>
        <Space>
          <Input
            placeholder="Search SKU or product"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 240 }}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Checkbox
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          >
            Low stock only
          </Checkbox>
        </Space>
      </div>

      <Table<SkuStock>
        columns={columns}
        dataSource={data?.content ?? []}
        rowKey={(r) => String(r.variantId)}
        loading={loading}
        pagination={{
          current: page + 1,
          total: data?.totalElements ?? 0,
          pageSize: 20,
          onChange: (p) => setPage(p - 1),
          showTotal: (t) => `${t} rows`,
        }}
        size="small"
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
