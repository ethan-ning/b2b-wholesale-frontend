import { Table } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Variant } from '../api/types';
import { formatMoney } from '../utils/money';
import { StockBadge } from './StockBadge';
import { TOUCH, useIsNarrow } from '../hooks/useIsNarrow';

interface Props {
  variants: Variant[];
  /** Titles the differentiator column — "Size", "Pack Qty". */
  variantAxis?: string | null;
  compact?: boolean;
  /**
   * Whether each row gets a picture.
   *
   * `auto` earns the column: it appears only where the SKUs actually look different — a
   * finish or a colour. On the usual product every SKU shares the one photo, and a column
   * repeating it six times pushes the prices off a phone for nothing.
   *
   * `always` reserves it, placeholder and all, for the detail page — there a dealer is
   * comparing the SKUs of one product against each other, and a column that appears on
   * some products and not others is harder to read than a blank square.
   */
  images?: 'auto' | 'always';
  /** Given a thumbnail to click, so the big image above can follow the row. */
  onPickImage?: (variant: Variant) => void;
}

export default function SkuTable({
  variants,
  variantAxis,
  compact = false,
  images = 'auto',
  onPickImage,
}: Props) {
  const touch = useIsNarrow(TOUCH);

  const distinctImages = new Set(variants.map((v) => v.mainImageUrl).filter(Boolean));
  const showImages = images === 'always' || distinctImages.size > 1;

  const columns: ColumnsType<Variant> = [
    ...(showImages
      ? [{
          title: '',
          key: 'image',
          width: 52,
          render: (_: unknown, v: Variant) =>
            v.mainImageUrl ? (
              <img
                src={v.mainImageUrl}
                alt={v.sku}
                className="sku-thumb"
                loading="lazy"
                onClick={onPickImage ? () => onPickImage(v) : undefined}
                style={onPickImage ? { cursor: 'pointer' } : undefined}
              />
            ) : (
              // The slot stays, so the SKU column starts in the same place on every row.
              <span className="sku-thumb sku-thumb--empty" aria-label="No image for this SKU">
                <PictureOutlined />
              </span>
            ),
        }]
      : []),
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      fixed: touch ? ('left' as const) : undefined,
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
      render: (_: unknown, v: Variant) => <StockBadge qty={v.inventory.availableStock} low={v.inventory.lowStock} />,
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
      /*
       * Six columns do not fit a phone, and squeezing them wraps every price onto three
       * lines. The table scrolls sideways instead, with the SKU pinned — scrolled away
       * from its own code, a row of numbers belongs to nothing.
       */
      scroll={touch ? { x: 'max-content' } : undefined}
      style={{ marginTop: compact ? 8 : 0 }}
    />
  );
}
