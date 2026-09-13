import { Alert, Button, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import MoneyInput from '../MoneyInput';
import type { WarehouseStock } from '../../api/types';
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
  /**
   * False while the form has no base price. Every tier's figure comes off it, so there is
   * nothing yet for an override to depart from.
   */
  pricingReady: boolean;
  onPrice: (sku: string, tierId: number, price: number | null) => void;
  onMapPrice: (variantId: number, price: number | null) => void;
}

export default function SkuPricingTable({
  rows, variantAxis, stock, mapPrices, pricingReady, onPrice, onMapPrice,
}: Props) {

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
      title: 'Lists at',
      key: 'listPrice',
      width: 150,
      align: 'right',
      render: (_: unknown, row) => {
        if (row.tiers.length === 0) return <Text type="secondary">—</Text>;
        if (!pricingReady) return <Text type="secondary" style={{ fontSize: 12 }}>Set a base price</Text>;
        return (
          <Space size={6}>
            <Text>{money(row.listPrice)}</Text>
            {/* Only worth saying where a tier has actually been given its own figure. */}
            {row.customCount > 0 && (
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                {row.customCount} custom
              </Tag>
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
          <TierPrices row={row} pricingReady={pricingReady} onPrice={onPrice} />
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
function TierPrices({ row, pricingReady, onPrice }: {
  row: SkuRow;
  pricingReady: boolean;
  onPrice: (sku: string, tierId: number, price: number | null) => void;
}) {
  if (!pricingReady) {
    return (
      <Alert
        type="info"
        showIcon
        message="Set a base wholesale price first"
        description="Every tier's price comes off that figure, so until there is one there is nothing for a custom price to depart from."
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
        const custom = tier.price !== null;
        return (
          <Space size={8}>
            {custom ? (
              <>
                <MoneyInput
                  size="small" precision={2} style={{ width: 110 }} value={tier.price ?? undefined}
                  placeholder={tier.standardPrice.toFixed(2)}
                  // Emptying the box gives the SKU back to its tier's rate rather than
                  // pricing it at nothing.
                  onChange={(v) => onPrice(row.variant.sku, tier.tier.id, v ?? null)}
                />
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>custom</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  rate gives {money(tier.standardPrice)}
                </Text>
                <Button size="small" type="link" style={{ padding: 0 }}
                  onClick={() => onPrice(row.variant.sku, tier.tier.id, null)}>
                  Revert
                </Button>
              </>
            ) : (
              <>
                <Text style={{ width: 110, display: 'inline-block' }}>{money(tier.standardPrice)}</Text>
                <Tag color="default" style={{ marginInlineEnd: 0 }}>rate</Tag>
                <Button size="small" type="link" style={{ padding: 0 }}
                  onClick={() => onPrice(row.variant.sku, tier.tier.id, tier.standardPrice)}>
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
