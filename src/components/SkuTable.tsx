import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Variant } from '../api/types';
import { StockBadge } from '../utils/stockBadge';

interface Props {
  variants: Variant[];
  /** SPU's variant axis — "Size", "Pack Qty". Titles the differentiator column. */
  variantAxis?: string | null;
  compact?: boolean;
}

export default function SkuTable({ variants, variantAxis, compact = false }: Props) {
  const columns: ColumnsType<Variant> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku: string) => <code style={{ fontSize: 12 }}>{sku}</code>,
    },
    {
      title: variantAxis ?? 'Variant',
      dataIndex: 'variantValue',
      key: 'variantValue',
      width: 80,
      align: 'right',
      render: (value: string | null, v: Variant) => value ?? v.packQuantity,
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
            title: 'Volume Price',
            key: 'priceBreaks',
            width: 140,
            align: 'right' as const,
            render: (_: unknown, v: Variant) =>
              v.priceBreaks.length === 0 ? (
                <span style={{ color: '#999' }}>—</span>
              ) : (
                v.priceBreaks.map((b) => (
                  <div key={b.minQty} style={{ fontSize: 12 }}>
                    {b.minQty}+: ${b.price.toFixed(2)}
                  </div>
                ))
              ),
          },
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
