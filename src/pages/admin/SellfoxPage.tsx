import { useCallback, useEffect, useState } from 'react';
import {
  Typography, Card, Table, Tag, Button, Space, Alert, Spin, Checkbox, Input,
  Tooltip, message, Empty,
} from 'antd';
import { SyncOutlined, ReloadOutlined, SearchOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type {
  SellfoxCategory, SellfoxHistory, SellfoxScope, SellfoxSyncRun, SellfoxWarehouse,
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

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

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
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextScope, nextHistory] = await Promise.all([
        api.fetchSellfoxScope(),
        api.fetchSyncRuns(25),
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
  const running = history?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [running, load]);

  async function trigger() {
    try {
      await api.triggerSync();
      message.success('Sync started');
      load();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(detail ?? 'Could not start the sync');
    }
  }

  // The API takes the whole selection, so a toggle and a clear are the same call.
  async function applyCategories(cids: string[]) {
    await api.selectCategories(cids);
    load();
  }

  async function applyWarehouses(ids: number[]) {
    await api.selectWarehouses(ids);
    load();
  }

  function toggleCategory(row: SellfoxCategory, on: boolean) {
    const next = new Set(selectedCategoryIds);
    if (on) next.add(row.cid); else next.delete(row.cid);
    applyCategories([...next]);
  }

  function toggleWarehouse(row: SellfoxWarehouse, on: boolean) {
    const next = new Set(selectedWarehouseIds);
    if (on) next.add(row.warehouseId); else next.delete(row.warehouseId);
    applyWarehouses([...next]);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message={error} showIcon />;

  const categories = (scope?.categories ?? []).filter((c) =>
    c.fullName.toLowerCase().includes(categoryFilter.trim().toLowerCase()));
  const warehouses = (scope?.warehouses ?? []).filter((w) =>
    w.name.toLowerCase().includes(warehouseFilter.trim().toLowerCase()));

  const selectedCategoryIds = (scope?.categories ?? []).filter((c) => c.selected).map((c) => c.cid);
  const selectedWarehouseIds = (scope?.warehouses ?? []).filter((w) => w.selected).map((w) => w.warehouseId);
  const scopeReady = selectedCategoryIds.length > 0 && selectedWarehouseIds.length > 0;
  const discovered = (scope?.categories.length ?? 0) > 0 || (scope?.warehouses.length ?? 0) > 0;

  const categoryColumns: ColumnsType<SellfoxCategory> = [
    {
      title: 'Import',
      dataIndex: 'selected',
      width: 80,
      render: (_, row) => (
        <Checkbox checked={row.selected} onChange={(e) => toggleCategory(row, e.target.checked)} />
      ),
    },
    { title: 'Category group', dataIndex: 'fullName' },
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
          <Tooltip
            title={
              scopeReady || !discovered
                ? 'Imports the selected categories, then counts them in the selected warehouses. Around two minutes.'
                : 'Select at least one category and one warehouse first'
            }
          >
            {/* A disabled button swallows hover, so the tooltip needs a wrapper. */}
            <span>
              <Button
                type="primary"
                icon={<CloudDownloadOutlined />}
                onClick={trigger}
                loading={running}
                disabled={running || (discovered && !scopeReady)}
              >
                {running ? 'Syncing…' : discovered ? 'Sync now' : 'Discover lists'}
              </Button>
            </span>
          </Tooltip>
        </Space>
      </div>

      <Paragraph type="secondary" style={{ fontSize: 13 }}>
        Sellfox is the system of record for what a product is and how many there are. A sync
        imports the products in the <b>selected categories</b>, then counts them in the
        <b> selected warehouses</b> — so a newly imported SKU has its stock in the same run.
        Imported products arrive <b>inactive and unpriced</b>: set tier pricing, then
        activate them.
      </Paragraph>

      {/* One section, two halves. They were separate cards, which read as two
          independent settings when in fact neither does anything without the other. */}
      <Card
        size="small"
        title="Import scope"
        style={{ marginBottom: 16 }}
        extra={
          scopeReady
            ? (
              <Tag color="success">
                {plural(selectedCategoryIds.length, 'category', 'categories')} ·{' '}
                {plural(selectedWarehouseIds.length, 'warehouse', 'warehouses')}
              </Tag>
            )
            : <Tag color="warning">Both are required</Tag>
        }
      >
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 440px', minWidth: 400 }}>
            <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
              <Text strong>
                Categories to import{' '}
                <Text type="secondary" style={{ fontWeight: 400 }}>
                  — {selectedCategoryIds.length} of {scope?.categories.length ?? 0}
                </Text>
              </Text>
              <Space size={8}>
                <Input
                  size="small"
                  placeholder="Filter"
                  prefix={<SearchOutlined />}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: 150 }}
                  allowClear
                />
                <Button
                  size="small"
                  type="link"
                  disabled={selectedCategoryIds.length === 0}
                  onClick={() => applyCategories([])}
                >
                  Clear
                </Button>
              </Space>
            </Space>

            {scope?.categories.length === 0 ? (
              <Empty
                description="Run a sync to discover them"
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              Chosen at the second level of Sellfox's tree — selecting a group takes
              everything beneath it.
            </Text>
          </div>

          <div style={{ flex: '1 1 400px', minWidth: 360 }}>
            <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
              <Text strong>
                Warehouses to count{' '}
                <Text type="secondary" style={{ fontWeight: 400 }}>
                  — {selectedWarehouseIds.length} of {scope?.warehouses.length ?? 0}
                </Text>
              </Text>
              <Space size={8}>
                <Input
                  size="small"
                  placeholder="Filter"
                  prefix={<SearchOutlined />}
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  style={{ width: 150 }}
                  allowClear
                />
                <Button
                  size="small"
                  type="link"
                  disabled={selectedWarehouseIds.length === 0}
                  onClick={() => applyWarehouses([])}
                >
                  Clear
                </Button>
              </Space>
            </Space>

            {scope?.warehouses.length === 0 ? (
              <Empty
                description="Run a sync to discover them"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                rowKey="warehouseId"
                size="small"
                columns={warehouseColumns}
                dataSource={warehouses}
                pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
              />
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              A SKU's stock is the sum across these — which is what keeps stock you cannot
              ship from out of the number a dealer sees.
            </Text>
          </div>
        </div>
      </Card>

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
