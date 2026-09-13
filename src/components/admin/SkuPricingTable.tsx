import { useState } from 'react';
import { Alert, Button, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import MoneyInput from '../MoneyInput';
import type { WarehouseStock } from '../../api/types';
import { isCustom } from './skuRows';
import type { SkuRow, TierRow } from './skuRows';

const { Text } = Typography;

const money = (n: number) => `$${n.toFixed(2)}`;

function syncedLabel(iso: string | undefined): string {
  if (!iso) return 'Never synced';
  const at = new Date(iso);
  return at.getUTCFullYear() <= 1970 ? 'Never synced' : `Synced ${at.toLocaleString()}`;
}

/**
 * One row per SKU: what it lists at, what it advertises at, and what is on the shelf.
 *
 * Tier prices are not here. A tier's rate answers for nearly every SKU, so putting all
 * of them on screen says the same thing once per row. They open underneath the SKU that
 * needs a different answer.
 */
interface Props {
  rows: SkuRow[];
  /** Titles the differentiator column — "Size", "Pack Qty". */
  variantAxis: string | null;
  /** Where each SKU's stock sits. The variant's own total is these summed. */
  stock: WarehouseStock[];
  /** Per-variant MAP, keyed by variant id. The one portal-owned field on a SKU. */
  mapPrices: Record<number, number | null>;
  onPrice: (sku: string, tierId: number, price: number | null) => void;
  /** The anchor: every other tier for this SKU is worked out from it. */
  onDefaultPrice: (sku: string, price: number | null) => void;
  onMapPrice: (variantId: number, price: number | null) => void;
}

export default function SkuPricingTable({
  rows, variantAxis, stock, mapPrices, onPrice, onDefaultPrice, onMapPrice,
}: Props) {
  // Which price boxes have been opened. Held here rather than in the expanded row, which
  // antd builds afresh on every render and would lose it the moment anything else moved.
  const [open, setOpen] = useState<Set<string>>(new Set());

  const stockBySku = new Map<string, WarehouseStock[]>();
  stock.forEach((line) => {
    stockBySku.set(line.sku, [...(stockBySku.get(line.sku) ?? []), line]);
  });

  const columns: ColumnsType<SkuRow> = [
    {
      title: 'SKU',
      key: 'sku',
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
      render: (_: unknown, row) => row.variant.variantValue ?? row.variant.packQuantity,
    },
    {
      title: 'Default price',
      key: 'defaultPrice',
      width: 190,
      align: 'right',
      render: (_: unknown, row) => {
        if (row.tiers.length === 0) return <Text type="secondary">—</Text>;
        return (
          <Space size={6}>
            <MoneyInput
              size="small" precision={2} style={{ width: 100 }}
              value={row.defaultPrice ?? undefined}
              onChange={(v) => onDefaultPrice(row.variant.sku, v ?? null)}
            />
            {/* Only where a tier has actually been given a different figure. */}
            {row.customCount > 0 && (
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>{row.customCount} custom</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'MAP',
      key: 'mapPrice',
      width: 120,
      align: 'right',
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
      key: 'supply',
      width: 110,
      align: 'right',
      render: (_: unknown, row) =>
        row.tiers.length === 0
          ? <Tag color="default">Discontinued</Tag>
          : <Tag color="green">On sale</Tag>,
    },
  ];

  return (
    <Table<SkuRow>
      rowKey="key"
      size="small"
      columns={columns}
      dataSource={rows}
      pagination={false}
      expandable={{
        // A withdrawn SKU has nothing to price, so it gets no arrow to open.
        rowExpandable: (row) => row.tiers.length > 0,
        expandedRowRender: (row) => (
          <TierPrices row={row} onPrice={onPrice} open={open} setOpen={setOpen} />
        ),
      }}
    />
  );
}

/**
 * What each tier pays for one SKU, and a way to depart from it.
 *
 * Every figure here follows the base price above as it is typed, so the effect of
 * changing it is visible before anything is saved.
 */
function TierPrices({ row, onPrice, open, setOpen }: {
  row: SkuRow;
  onPrice: (sku: string, tierId: number, price: number | null) => void;
  /** Tier rows whose box has been opened. One already priced differently counts as open. */
  open: Set<string>;
  setOpen: (next: Set<string>) => void;
}) {

  if (row.defaultPrice === null) {
    return (
      <Alert
        type="info"
        showIcon
        message="Set this SKU's default price first"
        description="Every other tier is worked out from it, so until there is one this SKU has no price at any tier."
      />
    );
  }

  const columns: ColumnsType<TierRow> = [
    {
      title: 'Tier',
      key: 'tier',
      width: 160,
      render: (_: unknown, tier) => (
        <Space size={6}>
          <Text strong>{tier.tier.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {tier.tier.discountPercent > 0 ? `${tier.tier.discountPercent}% off` : 'pays list'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Pays',
      key: 'price',
      width: 320,
      render: (_: unknown, tier) => {
        const custom = isCustom(tier);
        const editing = custom || open.has(tier.key);
        return (
          <Space size={8}>
            {editing ? (
              <>
                <MoneyInput
                  size="small" precision={2} style={{ width: 110 }} value={tier.price ?? undefined}
                  placeholder={(tier.standardPrice ?? 0).toFixed(2)}
                  // Emptying the box gives the SKU back to its tier's rate rather than
                  // pricing it at nothing.
                  onChange={(v) => onPrice(row.variant.sku, tier.tier.id, v ?? null)}
                />
                {custom
                  ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>custom</Tag>
                  : <Tag color="default" style={{ marginInlineEnd: 0 }}>rate</Tag>}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  rate gives {tier.standardPrice === null ? '—' : money(tier.standardPrice)}
                </Text>
                <Button size="small" type="link" style={{ padding: 0 }}
                  onClick={() => {
                    onPrice(row.variant.sku, tier.tier.id, null);
                    const next = new Set(open); next.delete(tier.key); setOpen(next);
                  }}>
                  Revert
                </Button>
              </>
            ) : (
              <>
                <Text style={{ width: 110, display: 'inline-block' }}>
                  {tier.standardPrice === null ? '—' : money(tier.standardPrice)}
                </Text>
                <Tag color="default" style={{ marginInlineEnd: 0 }}>rate</Tag>
                <Button size="small" type="link" style={{ padding: 0 }}
                  onClick={() => setOpen(new Set(open).add(tier.key))}>
                  Set a custom price
                </Button>
              </>
            )}
            {tier.breachesMap && (
              <Tooltip title="At or above this SKU's MAP — the dealer would have no margin">
                <Tag color="warning" style={{ marginInlineEnd: 0 }}>over MAP</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Table<TierRow>
      rowKey="key"
      size="small"
      columns={columns}
      dataSource={row.tiers}
      pagination={false}
      showHeader={false}
      style={{ maxWidth: 560 }}
    />
  );
}
