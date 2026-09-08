import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Variant } from '../api/types';
import { StockBadge } from '../utils/stockBadge';

interface Props {
  variants: Variant[];
  compact?: boolean;
}

export default function SkuTable({ variants, compact = false }: Props) {
  const columns: ColumnsType<Variant> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku: string) => <code style={{ fontSize: 12 }}>{sku}</code>,
    },
    {
      title: 'Pack Qty',
      dataIndex: 'packQuantity',
      key: 'packQuantity',
      width: 80,
      align: 'right',
    },
    {
      title: 'Unit Price',
      dataIndex: 'tierPrice',
      key: 'tierPrice',
      width: 100,
      align: 'right',
      render: (price: number) => `$${price.toFixed(2)}`,
    },
    {
      title: 'Available',
      key: 'available',
      width: 100,
      align: 'right',
      render: (_: unknown, v: Variant) => <StockBadge qty={v.inventory.availableStock} />,
    },
    {
      title: 'Incoming',
      key: 'incoming',
      width: 90,
      align: 'right',
      render: (_: unknown, v: Variant) =>
        v.inventory.incomingStock > 0 ? (
          <span style={{ color: '#1677ff' }}>+{v.inventory.incomingStock}</span>
        ) : (
          <span style={{ color: '#999' }}>—</span>
        ),
    },
    ...(!compact
      ? [
          {
            title: 'UPC',
            dataIndex: 'upc',
            key: 'upc',
            render: (upc: string | null) => upc ?? '—',
          },
        ]
      : []),
  ];

  return (
    <Table<Variant>
      columns={columns}
      dataSource={variants}
      rowKey="id"
      size="small"
      pagination={false}
      style={{ marginTop: compact ? 8 : 0 }}
    />
  );
}
