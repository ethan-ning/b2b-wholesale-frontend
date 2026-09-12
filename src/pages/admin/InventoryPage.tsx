import { useState } from 'react';
import { Table, Input, Checkbox, Card, Tag, Alert } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type { SkuStock } from '../../api/types';
import { useDebounced } from '../../hooks/useDebounced';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { StockBadge } from '../../components/StockBadge';
import { listLocale } from '../../components/listLocale';
import { DEFAULT_PAGE_SIZE, listPagination } from '../../components/listPagination';
import PageHeader from '../../components/admin/PageHeader';

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  // The box stays immediate; the API is asked once the typing stops. Every other
  // control here is a single click, so none of them wait.
  const settledSearch = useDebounced(search);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data, loading, error, page, setPage } = usePagedQuery(
    (f, p) => api.fetchInventory({ ...f, page: p }),
    { search: settledSearch, lowStockOnly , size: pageSize }
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
      <PageHeader
        title="Inventory"
        subtitle="Read-only. Sellfox owns these numbers; the portal refreshes them hourly."
        actions={
          <>
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
          </>
        }
      />

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
      <Card size="small" className="section-card">
      <Table<SkuStock>
        columns={columns}
        dataSource={data?.content ?? []}
        rowKey={(r) => String(r.variantId)}
        loading={loading}
        locale={listLocale(loading, 'No SKUs match these filters.')}
        pagination={listPagination({
          page, pageSize, total: data?.totalElements ?? 0, setPage, setPageSize, label: 'SKUs',
        })}
        size="small"
        scroll={{ x: 'max-content' }}
      />
      </Card>
    </div>
  );
}
