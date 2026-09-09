import { useCallback, useEffect, useState } from 'react';
import {
  Typography, Card, Table, Tag, Button, Space, Alert, Spin, Checkbox, Input,
  Tooltip, message, Empty,
} from 'antd';
import { SyncOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type {
  SellfoxCategory, SellfoxHistory, SellfoxJob, SellfoxScope, SellfoxSyncRun, SellfoxWarehouse,
} from '../../api/types';

const { Title, Text, Paragraph } = Typography;

/** Sellfox's own warehouse classification. */
const WAREHOUSE_TYPE: Record<number, string> = {
  0: 'Default',
  1: 'Domestic (CN)',
  2: 'FBA',
  3: 'Overseas',
};

const STATUS_COLOR: Record<SellfoxSyncRun['status'], string> = {
  RUNNING: 'processing',
  SUCCESS: 'success',
  FAILED: 'error',
};

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function formatDuration(run: SellfoxSyncRun): string {
  if (!run.finishedAt) return 'running…';
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  return ms < 1000 ? '<1s' : `${Math.round(ms / 1000)}s`;
}

export default function SellfoxPage() {
  const [scope, setScope] = useState<SellfoxScope | null>(null);
  const [history, setHistory] = useState<SellfoxHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextScope, nextHistory] = await Promise.all([
        api.fetchSellfoxScope(),
        api.fetchSyncRuns(undefined, 25),
      ]);
      setScope(nextScope);
      setHistory(nextHistory);
      setError(null);
    } catch {
      setError('Could not reach the sync service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // While a run is in flight its outcome only arrives by asking again. Polling stops
  // the moment nothing is running, so an idle screen is not making requests.
  const anyRunning = Object.values(history?.running ?? {}).some(Boolean);
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [anyRunning, load]);

  async function trigger(job: SellfoxJob) {
    try {
      await api.triggerSync(job);
      message.success(`${job === 'CATALOG' ? 'Catalog' : 'Inventory'} sync started`);
      load();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(detail ?? 'Could not start the sync');
    }
  }

  async function toggleCategory(row: SellfoxCategory, selected: boolean) {
    await api.setCategorySelected(row.cid, selected);
    load();
  }

  async function toggleWarehouse(row: SellfoxWarehouse, selected: boolean) {
    await api.setWarehouseSelected(row.warehouseId, selected);
    load();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message={error} showIcon />;

  const categories = (scope?.categories ?? []).filter((c) =>
    c.fullName.toLowerCase().includes(categoryFilter.trim().toLowerCase()));
  const selectedCategories = scope?.categories.filter((c) => c.selected).length ?? 0;
  const selectedWarehouses = scope?.warehouses.filter((w) => w.selected).length ?? 0;

  const categoryColumns: ColumnsType<SellfoxCategory> = [
    {
      title: 'Import',
      dataIndex: 'selected',
      width: 80,
      render: (_, row) => (
        <Checkbox checked={row.selected} onChange={(e) => toggleCategory(row, e.target.checked)} />
      ),
    },
    { title: 'Category', dataIndex: 'fullName' },
    {
      title: 'SKUs',
      dataIndex: 'commodityCount',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.commodityCount - b.commodityCount,
      defaultSortOrder: 'descend',
    },
  ];

  const warehouseColumns: ColumnsType<SellfoxWarehouse> = [
    {
      title: 'Count stock',
      dataIndex: 'selected',
      width: 110,
      render: (_, row) => (
        <Checkbox checked={row.selected} onChange={(e) => toggleWarehouse(row, e.target.checked)} />
      ),
    },
    { title: 'Warehouse', dataIndex: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 140,
      render: (type: number | null) =>
        type === null ? '—' : <Tag>{WAREHOUSE_TYPE[type] ?? `Type ${type}`}</Tag>,
    },
  ];

  const runColumns: ColumnsType<SellfoxSyncRun> = [
    {
      title: 'Job',
      dataIndex: 'job',
      width: 110,
      render: (job: SellfoxJob) => <Tag color={job === 'CATALOG' ? 'blue' : 'geekblue'}>{job}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (status: SellfoxSyncRun['status']) => (
        <Tag color={STATUS_COLOR[status]} icon={status === 'RUNNING' ? <SyncOutlined spin /> : undefined}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Started',
      dataIndex: 'startedAt',
      width: 190,
      render: (iso: string) => formatTime(iso),
    },
    { title: 'Took', width: 90, render: (_, run) => formatDuration(run) },
    {
      title: 'Trigger',
      width: 150,
      render: (_, run) => (
        <Space size={4}>
          <Tag color={run.trigger === 'MANUAL' ? 'purple' : 'default'}>{run.trigger}</Tag>
          {run.triggeredBy && <Text type="secondary" style={{ fontSize: 12 }}>{run.triggeredBy}</Text>}
        </Space>
      ),
    },
    {
      title: 'Records',
      width: 190,
      render: (_, run) => (
        <Text style={{ fontSize: 12 }}>
          read <b>{run.recordsRead}</b> · wrote <b>{run.recordsWritten}</b> · skipped {run.recordsSkipped}
        </Text>
      ),
    },
    {
      title: 'Outcome',
      render: (_, run) =>
        run.errorMessage
          ? <Text type="danger" style={{ fontSize: 12 }}>{run.errorMessage}</Text>
          : <Text style={{ fontSize: 12 }}>{run.summary ?? '—'}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Sellfox Sync</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Tooltip title="Reads only the selected warehouses. Takes a few seconds.">
            <Button
              onClick={() => trigger('INVENTORY')}
              loading={history?.running.INVENTORY}
              disabled={history?.running.INVENTORY}
            >
              Sync stock now
            </Button>
          </Tooltip>
          <Tooltip title="Pages every commodity Sellfox holds — around two minutes.">
            <Button
              type="primary"
              onClick={() => trigger('CATALOG')}
              loading={history?.running.CATALOG}
              disabled={history?.running.CATALOG}
            >
              Sync catalog now
            </Button>
          </Tooltip>
        </Space>
      </div>

      <Paragraph type="secondary" style={{ fontSize: 13 }}>
        Sellfox is the system of record for what a product is and how many there are.
        Nothing is imported from a category until you select it below, so a first sync only
        fills in the lists. Imported products arrive <b>inactive and unpriced</b> — set tier
        pricing, then activate them.
      </Paragraph>

      <Space align="start" size={16} style={{ display: 'flex', marginBottom: 16 }} wrap>
        <Card
          size="small"
          title={`Categories to import — ${selectedCategories} selected`}
          style={{ flex: '1 1 460px', minWidth: 420 }}
          extra={
            <Input
              size="small"
              placeholder="Filter"
              prefix={<SearchOutlined />}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: 160 }}
              allowClear
            />
          }
        >
          {scope?.categories.length === 0 ? (
            <Empty
              description="No categories yet — run a catalog sync to discover them"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              rowKey="cid"
              size="small"
              columns={categoryColumns}
              dataSource={categories}
              pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
            />
          )}
        </Card>

        <Card
          size="small"
          title={`Warehouses to count — ${selectedWarehouses} selected`}
          style={{ flex: '1 1 420px', minWidth: 380 }}
        >
          {scope?.warehouses.length === 0 ? (
            <Empty
              description="No warehouses yet — run a stock sync to discover them"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <>
              <Table
                rowKey="warehouseId"
                size="small"
                columns={warehouseColumns}
                dataSource={scope?.warehouses ?? []}
                pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                A SKU's stock is the sum across the warehouses selected here — which is what
                keeps stock you cannot ship from out of the number a dealer sees.
              </Text>
            </>
          )}
        </Card>
      </Space>

      <Card size="small" title="Run history">
        <Table
          rowKey="id"
          size="small"
          columns={runColumns}
          dataSource={history?.runs ?? []}
          pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
          locale={{ emptyText: 'No sync has run yet.' }}
        />
      </Card>
    </div>
  );
}
