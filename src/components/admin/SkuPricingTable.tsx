import { useState } from 'react';
import { Button, Space, Table, Tag, Tooltip, Typography } from 'antd';
import MoneyInput from '../MoneyInput';
import type { ColumnsType } from 'antd/es/table';
import type { WarehouseStock } from '../../api/types';
import type { SkuRow } from './skuRows';

const { Text } = Typography;

const money = (n: number) => `$${n.toFixed(2)}`;

function syncedLabel(iso: string | undefined): string {
  if (!iso) return 'Never synced';
  const at = new Date(iso);
  return at.getUTCFullYear() <= 1970 ? 'Never synced' : `Synced ${at.toLocaleString()}`;
}

/**
 * One row per SKU per tier — the price grid and the SKU list are one table.
 *
 * They used to be two, and reading them meant holding a SKU code in your head while
 * looking from one to the other: what a SKU costs and whether it is still on sale are the
 * same question asked twice. `tier` is null for a withdrawn SKU, which gets a single row
 * and no price boxes — the supplier has stopped selling it, so there is nothing to price.
 */
interface Props {
  rows: SkuRow[];
  /** Titles the differentiator column — "Size", "Pack Qty". */
  variantAxis: string | null;
  /** Where each SKU's stock sits. The variant's own total is these summed. */
  stock: WarehouseStock[];
  /** Per-variant MAP, keyed by variant id. The one portal-owned field on a SKU. */
  mapPrices: Record<number, number | null>;
  onPrice: (row: SkuRow, price: number | null) => void;
  onMapPrice: (variantId: number, price: number | null) => void;
}

export default function SkuPricingTable({
  rows, variantAxis, stock, mapPrices, onPrice, onMapPrice,
}: Props) {
  // Which rows have had their price box opened. A row that already carries an override
  // counts as open without being in here, so reopening the page shows what was set.
  const [open, setOpen] = useState<Set<string>>(new Set());

  const stockBySku = new Map<string, WarehouseStock[]>();
  stock.forEach((line) => {
    stockBySku.set(line.sku, [...(stockBySku.get(line.sku) ?? []), line]);
  });

  // Everything true of the SKU rather than of one tier merges down over its tier rows.
  // Precomputed by index and kept pure — onCell can fire more than once per row.
  const spans = rows.map((row, i) =>
    i > 0 && rows[i - 1].variant.sku === row.variant.sku
      ? 0
      : rows.filter((r) => r.variant.sku === row.variant.sku).length
  );
  const mergeDown = (_row: SkuRow, index?: number) => ({ rowSpan: spans[index ?? 0] ?? 1 });

  const skuColumns: ColumnsType<SkuRow> = [
    {
      title: 'SKU',
      key: 'sku',
      width: 210,
      onCell: mergeDown,
      render: (_: unknown, row) => (
        <div>
          <code style={{ fontSize: 12 }}>{row.variant.sku}</code>
          <div style={{ fontSize: 11, color: '#999' }}>
            {row.variant.upc ? `UPC ${row.variant.upc}` : 'No UPC'}
            {row.variant.weight ? ` · ${row.variant.weight} kg` : ''}
          </div>
        </div>
      ),
    },
    {
      title: variantAxis ?? 'Variant',
      key: 'variantValue',
      width: 90,
      align: 'right',
      onCell: mergeDown,
      render: (_: unknown, row) => row.variant.variantValue ?? row.variant.packQuantity,
    },
    {
      title: 'Tier',
      key: 'tier',
      width: 130,
      render: (_: unknown, row) =>
        row.tier ? (
          <Space size={6}>
            <span>{row.tier.name}</span>
            {/* Every row is minQty 1 today, so the tag is inert. Kept so enabling volume
                breaks is an insert of rows, not a UI change (architecture doc §2.2.1). */}
            {row.minQty > 1 && <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>{row.minQty}+</Tag>}
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Not for sale</Text>
        ),
    },
    {
      title: 'Dealer price',
      key: 'price',
      width: 230,
      align: 'right',
      render: (_: unknown, row) => {
        if (row.tier === null) return <Text type="secondary">—</Text>;

        const custom = row.price !== null;
        const editing = custom || open.has(row.key);

        /*
         * A price is shown, not asked for. Every SKU has one the moment it is imported —
         * its tier's standing rate — so the grid used to open with a box per tier per SKU
         * inviting someone to fill in figures that were already decided. The box appears
         * when somebody says they want to depart from the rate.
         */
        if (!editing) {
          return (
            <Space size={6}>
              {row.breachesMap && (
                <Tooltip title="At or above this SKU's MAP — the dealer would have no margin">
                  <Tag color="warning" style={{ marginInlineEnd: 0 }}>over MAP</Tag>
                </Tooltip>
              )}
              <Text>{money(row.standardPrice)}</Text>
              <Tooltip title={`${row.tier.name} pays ${row.tier.discountPercent}% off list`}>
                <Tag color="default" style={{ marginInlineEnd: 0 }}>standard</Tag>
              </Tooltip>
              <Button size="small" type="link" style={{ padding: 0 }}
                onClick={() => setOpen(new Set(open).add(row.key))}>
                Change
              </Button>
            </Space>
          );
        }

        return (
          <Space size={6} direction="vertical" style={{ width: '100%' }} align="end">
            <MoneyInput
              size="small" precision={2} style={{ width: '100%' }} value={row.price ?? undefined}
              placeholder={String(row.standardPrice.toFixed(2))}
              // Emptying the box gives the SKU back to its tier's rate rather than
              // pricing it at nothing.
              onChange={(v) => onPrice(row, v ?? null)}
            />
            <Space size={6}>
              {row.breachesMap && (
                <Tooltip title="At or above this SKU's MAP — the dealer would have no margin">
                  <Tag color="warning" style={{ marginInlineEnd: 0 }}>over MAP</Tag>
                </Tooltip>
              )}
              {custom
                ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>custom</Tag>
                : <Text type="secondary" style={{ fontSize: 11 }}>empty keeps the standard rate</Text>}
              <Text type="secondary" style={{ fontSize: 11 }}>
                standard {money(row.standardPrice)}
              </Text>
              <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }}
                onClick={() => {
                  onPrice(row, null);
                  const next = new Set(open); next.delete(row.key); setOpen(next);
                }}>
                Revert
              </Button>
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'MAP',
      key: 'mapPrice',
      width: 120,
      align: 'right',
      onCell: mergeDown,
      render: (_: unknown, row) => (
        <MoneyInput
          size="small" precision={2} style={{ width: '100%' }}
          value={mapPrices[row.variant.id] ?? undefined}
          onChange={(val) => onMapPrice(row.variant.id, val ?? null)}
        />
      ),
    },
    {
      title: 'Stock',
      key: 'stock',
      width: 250,
      onCell: mergeDown,
      render: (_: unknown, row) => {
        const lines = stockBySku.get(row.variant.sku) ?? [];
        const { availableStock, incomingStock, updatedAt } = row.variant.inventory;
        return (
          <Tooltip title={syncedLabel(lines[0]?.syncedAt ?? updatedAt)}>
            <div>
              <div style={{ fontWeight: 500 }}>
                {availableStock} available
                {incomingStock > 0 && (
                  <Text style={{ color: '#1677ff', fontWeight: 400 }}> · {incomingStock} on the way</Text>
                )}
              </div>
              {lines.length === 0 ? (
                // Sellfox reports no row for a warehouse that has never held the SKU, so
                // this is "stocked nowhere in scope" rather than "not synced".
                <Text type="secondary" style={{ fontSize: 11 }}>Not stocked in any warehouse in scope</Text>
              ) : (
                lines.map((l) => (
                  <div key={l.warehouseId} style={{ display: 'flex', gap: 8, fontSize: 11, color: '#666' }}>
                    <span style={{ flex: 1 }}>{l.warehouseName}</span>
                    <span style={{ width: 40, textAlign: 'right' }}>{l.available}</span>
                    <span style={{ width: 48, textAlign: 'right', color: l.incoming ? '#1677ff' : '#bbb' }}>
                      {l.incoming ? `+${l.incoming}` : '—'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Supply',
      key: 'status',
      width: 110,
      onCell: mergeDown,
      render: (_: unknown, row) =>
        row.variant.status === 'ACTIVE' ? (
          <Tag color="success">On sale</Tag>
        ) : (
          <Tooltip title="Sellfox no longer sells this SKU. Dealers cannot see it; its pricing is kept in case it returns.">
            <Tag color="default">Withdrawn</Tag>
          </Tooltip>
        ),
    },
  ];

  return (
    <Table<SkuRow>
      columns={skuColumns}
      dataSource={rows}
      rowKey="key"
      size="small"
      pagination={false}
      bordered
      scroll={{ x: 'max-content' }}
      /* Dimmed whole-row: the tag alone reads as a detail, but a withdrawn SKU changes
         what the row means — none of it is on offer. */
      rowClassName={(row) => (row.variant.status === 'DISCONTINUED' ? 'row-withdrawn' : '')}
    />
  );
}
