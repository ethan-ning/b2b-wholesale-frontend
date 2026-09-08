import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Variant } from '../api/types';
import { formatMoney } from '../utils/money';
import { StockBadge } from '../utils/stockBadge';

interface Props {
  variants: Variant[];
  /** Titles the differentiator column — "Size", "Pack Qty". */
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
      // On a pack SKU this is the whole pack, so show per-unit beneath it.
      title: 'Price',
      dataIndex: 'tierPrice',
      key: 'tierPrice',
      width: 110,
      align: 'right',
      render: (price: number, v: Variant) => (
        <>
          <div>{formatMoney(price)}</div>
          {v.packQuantity > 1 && (
            <div style={{ fontSize: 11, color: '#999' }}>{formatMoney(v.unitPrice)}/ea</div>
          )}
        </>
      ),
    },
    {
      title: 'MAP',
      dataIndex: 'mapPrice',
      key: 'mapPrice',
      width: 100,
      align: 'right',
      render: (map: number | null, v: Variant) =>
        map === null ? (
          <span style={{ color: '#999' }}>—</span>
        ) : (
          <>
            <div style={{ color: '#666' }}>{formatMoney(map)}</div>
            {v.packQuantity > 1 && (
              <div style={{ fontSize: 11, color: '#bbb' }}>
                {formatMoney(map / v.packQuantity)}/ea
              </div>
            )}
          </>
        ),
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
