import { useEffect, useState, useCallback } from 'react';
import { Table, Select, Checkbox, Typography, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import adminClient from '../../api/adminClient';
import type { InventoryRow, Warehouse, PagedResult } from '../../api/types';
import { StockBadge } from '../../utils/stockBadge';

const { Title } = Typography;

export default function InventoryPage() {
  const [data, setData] = useState<PagedResult<InventoryRow> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    adminClient.get<Warehouse[]>('/admin/warehouses').then(({ data }) => setWarehouses(data));
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), size: '20' };
      if (warehouseId) params.warehouse = String(warehouseId);
      if (lowStockOnly) params.lowStock = 'true';
      const { data: res } = await adminClient.get<PagedResult<InventoryRow>>('/admin/inventory', { params });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, lowStockOnly, page]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);
  useEffect(() => { setPage(0); }, [warehouseId, lowStockOnly]);

  const columns: ColumnsType<InventoryRow> = [
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
    { title: 'Warehouse', dataIndex: 'warehouseName', key: 'warehouse', width: 140 },
    {
      title: 'Available',
      dataIndex: 'availableStock',
      key: 'available',
      width: 100,
      align: 'right',
      render: (v: number) => <StockBadge qty={v} />,
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
      title: 'Reserved',
      dataIndex: 'reservedStock',
      key: 'reserved',
      width: 85,
      align: 'right',
      render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : '—',
    },
    {
      title: 'Defective',
      dataIndex: 'defectiveStock',
      key: 'defective',
      width: 85,
      align: 'right',
      render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : '—',
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  const warehouseOptions = [
    { value: 0, label: 'All warehouses' },
    ...warehouses.map((w) => ({ value: w.id, label: w.name })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Inventory</Title>
        <Space>
          <Select
            value={warehouseId ?? 0}
            options={warehouseOptions}
            onChange={(v) => setWarehouseId(v === 0 ? null : v)}
            style={{ width: 180 }}
          />
          <Checkbox
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          >
            Low stock only (&lt; 5)
          </Checkbox>
        </Space>
      </div>

      <Table<InventoryRow>
        columns={columns}
        dataSource={data?.content ?? []}
        rowKey={(r) => `${r.variantId}-${r.warehouseId}`}
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
