import { useState } from 'react';
import { Alert, Button, Card, InputNumber, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import { apiErrorMessage } from '../../api/http';
import { PageError } from '../../components/PageState';
import PageHeader from '../../components/admin/PageHeader';
import { listLocale } from '../../components/listLocale';
import { useResource } from '../../hooks/useResource';
import type { CustomerTier } from '../../api/types';

const { Text } = Typography;

/**
 * What each tier pays, as a standing agreement rather than a figure per SKU.
 *
 * This is the screen that prices the catalogue: a rate here applies to every SKU nobody
 * has quoted separately, which is nearly all of them. A product's own page can still
 * depart from it one SKU at a time.
 */
export default function TierPricingPage() {
  const { data, loading, error, reload } = useResource(api.fetchTiers, []);
  const [edits, setEdits] = useState<Record<number, number | null>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const tiers = data ?? [];

  async function save(tier: CustomerTier) {
    const next = edits[tier.id];
    if (next === null || next === undefined) return;
    setSaving(tier.id);
    try {
      await api.setTierDiscount(tier.id, next);
      message.success(`${tier.name} now pays ${next}% off list`);
      setEdits((current) => {
        const { [tier.id]: _dropped, ...rest } = current;
        return rest;
      });
      reload();
    } catch (e: unknown) {
      // Verbatim: the refusal names the number, which is what needs correcting.
      message.error(apiErrorMessage(e, 'Could not change that rate.'));
    } finally {
      setSaving(null);
    }
  }

  const columns: ColumnsType<CustomerTier> = [
    {
      title: 'Tier',
      key: 'name',
      render: (_, tier) => (
        <Space>
          <Text strong>{tier.name}</Text>
          {tier.discountPercent === 0 && <Tag color="default">pays list</Tag>}
        </Space>
      ),
    },
    {
      title: 'Discount off list',
      key: 'discount',
      width: 260,
      render: (_, tier) => {
        const pending = edits[tier.id];
        const dirty = pending !== undefined && pending !== null && pending !== tier.discountPercent;
        return (
          <Space>
            <InputNumber
              size="small"
              min={0}
              max={99.99}
              step={0.5}
              precision={2}
              addonAfter="%"
              style={{ width: 130 }}
              value={pending ?? tier.discountPercent}
              onChange={(v) => setEdits((c) => ({ ...c, [tier.id]: v }))}
            />
            <Button
              size="small"
              type="primary"
              disabled={!dirty}
              loading={saving === tier.id}
              onClick={() => save(tier)}
            >
              Save
            </Button>
          </Space>
        );
      },
    },
    {
      title: 'A $100 SKU costs',
      key: 'example',
      width: 160,
      align: 'right',
      // A rate is hard to feel; a price is not.
      render: (_, tier) => <Text>${(100 * (1 - tier.discountPercent / 100)).toFixed(2)}</Text>,
    },
  ];

  if (error) return <PageError message="Failed to load the pricing tiers." />;

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader
        title="Tier pricing"
        subtitle="What each tier pays, before anyone prices a single SKU."
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="A rate here prices the whole catalogue"
        description="It applies to every SKU nobody has quoted separately. To depart from it for one SKU, open that product and change the price on its row."
      />

      <Card size="small">
        <Table<CustomerTier>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={tiers}
          loading={loading}
          pagination={false}
          locale={listLocale(loading, 'No tiers.')}
        />
      </Card>
    </div>
  );
}
