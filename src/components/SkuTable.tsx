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
      // Price for one of this SKU. On a pack SKU that is the whole pack, so show the
      // per-unit breakdown beneath it — the pack total is what the dealer pays, the
      // per-unit figure is what they compare against a single.
      title: 'Price',
      dataIndex: 'tierPrice',
      key: 'tierPrice',
      width: 110,
      align: 'right',
      render: (price: number, v: Variant) => (
        <>
          <div>${price.toFixed(2)}</div>
          {v.packQuantity > 1 && (
            <div style={{ fontSize: 11, color: '#999' }}>${v.unitPrice.toFixed(2)}/ea</div>
          )}
        </>
      ),
    },
    {
      // Same basis as Price, so the two compare directly on every row.
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
            <div style={{ color: '#666' }}>${map.toFixed(2)}</div>
            {v.packQuantity > 1 && (
              <div style={{ fontSize: 11, color: '#bbb' }}>
                ${(map / v.packQuantity).toFixed(2)}/ea
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
    // No volume-price column: quantity-based pricing is out of MVP scope (there is no
    // cart to act on it, and pack SKUs already express bulk buying for parts).
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
