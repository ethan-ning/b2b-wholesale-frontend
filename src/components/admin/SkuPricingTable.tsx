import { InputNumber, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CustomerTier, TierPrice, Variant, WarehouseStock } from '../../api/types';

const { Text } = Typography;

/**
 * One row per SKU per tier — the price grid and the SKU list are one table.
 *
 * They used to be two, and reading them meant holding a SKU code in your head while
 * looking from one to the other: what a SKU costs and whether it is still on sale are the
 * same question asked twice. `tier` is null for a withdrawn SKU, which gets a single row
 * and no price boxes — the supplier has stopped selling it, so there is nothing to price.
 */
export type SkuRow = {
  key: string;
  variant: Variant;
  tier: CustomerTier | null;
  minQty: number;
  /**
   * Null for a row nobody has filled in. A blank leaves the SKU unpriced; a zero would
   * price it at nothing and let it go on sale for free.
   */
  price: number | null;
};

export function buildSkuRows(
  variants: Variant[],
  tiers: CustomerTier[],
  existing: TierPrice[],
): SkuRow[] {
  const priced = new Map(existing.map((r) => [`${r.sku}:${r.tierId}:${r.minQty}`, r]));
  return variants.flatMap((variant): SkuRow[] => {
    if (variant.status === 'DISCONTINUED') {
      return [{ key: `${variant.sku}:none`, variant, tier: null, minQty: 1, price: null }];
    }
    return tiers.map((tier) => ({
      key: `${variant.sku}:${tier.id}`,
      variant,
      tier,
      minQty: 1,
      price: priced.get(`${variant.sku}:${tier.id}:1`)?.price ?? null,
    }));
  });
}

/** Epoch means the stock sync has never reached this SKU, not that it synced in 1970. */
function syncedLabel(iso: string | undefined): string {
  if (!iso) return 'Never synced';
  const at = new Date(iso);
  return at.getUTCFullYear() <= 1970 ? 'Never synced' : `Synced ${at.toLocaleString()}`;
}

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
      width: 140,
      align: 'right',
      render: (_: unknown, row) =>
        row.tier === null ? (
          <Text type="secondary">—</Text>
        ) : (
          <InputNumber
            size="small" prefix="$" min={0} precision={2} style={{ width: '100%' }} value={row.price}
            // Clearing the box means "not priced", not "priced at zero".
            onChange={(v) => onPrice(row, v ?? null)}
          />
        ),
    },
    {
      title: 'MAP',
      key: 'mapPrice',
      width: 120,
      align: 'right',
      onCell: mergeDown,
      render: (_: unknown, row) => (
        <InputNumber
          prefix="$" size="small" min={0} precision={2} style={{ width: '100%' }}
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
