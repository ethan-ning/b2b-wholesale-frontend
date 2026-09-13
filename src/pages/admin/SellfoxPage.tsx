import { useEffect, useState } from 'react';
import { useResource } from '../../hooks/useResource';
import {
  Typography, Card, Table, Tag, Button, Space, Checkbox, Input,
  Tooltip, message, Empty, Modal, Descriptions,
} from 'antd';
import {
  SyncOutlined, SearchOutlined, CloudDownloadOutlined, EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import PageHeader from '../../components/admin/PageHeader';
import { PageError, PageLoading } from '../../components/PageState';
import { apiErrorMessage } from '../../api/http';
import type {
  SellfoxCategory, SellfoxSyncRun, SellfoxWarehouse, SyncMode, TriggerableSyncMode,
} from '../../api/types';

const { Text, Paragraph } = Typography;

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

const MODE_LABEL: Record<SyncMode, string> = {
  FULL: 'Full',
  INVENTORY: 'Stock',
  REGROUP: 'Regroup',
};

const MODE_COLOR: Record<SyncMode, string> = {
  FULL: 'blue',
  INVENTORY: 'default',
  REGROUP: 'cyan',
};

const TRIGGER_LABEL: Record<SellfoxSyncRun['trigger'], string> = {
  SCHEDULED: 'Scheduled',
  MANUAL: 'Manual',
  SCOPE_CHANGE: 'Scope changed',
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
  // Both in one request, because the page is meaningless with only half of it.
  const { data, loading, error, reload } = useResource(
    async () => {
      const [scope, history] = await Promise.all([api.fetchSellfoxScope(), api.fetchSyncRuns(25)]);
      return { scope, history };
    },
    [],
  );
  const scope = data?.scope ?? null;
  const history = data?.history ?? null;

  // The scope is a settled decision, so it reads as one until asked otherwise. Editing
  // holds a draft rather than writing per click: a half-changed scope with a run firing
  // in the gap is exactly what the single save call exists to prevent.
  const [editing, setEditing] = useState(false);
  const [draftCategories, setDraftCategories] = useState<Set<string>>(new Set());
  const [draftWarehouses, setDraftWarehouses] = useState<Set<number>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [saving, setSaving] = useState(false);



  // While a run is in flight its outcome only arrives by asking again. Polling stops the
  // moment nothing is running, so an idle screen is not making requests.
  const running = history?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [running, reload]);

  const selectedCategories = (scope?.categories ?? []).filter((c) => c.selected);
  const selectedWarehouses = (scope?.warehouses ?? []).filter((w) => w.selected);
  const configured = selectedCategories.length > 0 && selectedWarehouses.length > 0;
  const discovered = (scope?.categories.length ?? 0) > 0;
  const draftReady = draftCategories.size > 0 && draftWarehouses.size > 0;

  function startEditing() {
    setDraftCategories(new Set(selectedCategories.map((c) => c.cid)));
    setDraftWarehouses(new Set(selectedWarehouses.map((w) => w.warehouseId)));
    setCategoryFilter('');
    setWarehouseFilter('');
    setEditing(true);
  }

  /**
   * Saving is not only saving. Narrowing the scope leaves products in the catalog that
   * should no longer be there, and only the run that follows deactivates them — so the
   * confirmation says so before the admin agrees to it.
   */
  function saveScope() {
    Modal.confirm({
      title: 'Change the import scope?',
      width: 520,
      content: (
        <>
          <Paragraph style={{ marginBottom: 8 }}>
            This starts a <b>full sync</b> — a couple of minutes — which imports everything
            in the new scope.
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            Products no longer in scope are <b>deactivated</b>, so dealers stop seeing them.
            Nothing is deleted and their tier pricing is kept — putting the category back
            re-imports them, though you would activate them again yourself.
          </Paragraph>
        </>
      ),
      okText: 'Save and sync',
      onOk: async () => {
        setSaving(true);
        try {
          await api.setScope([...draftCategories], [...draftWarehouses]);
          message.success('Scope saved — full sync started');
          setEditing(false);
          reload();
        } catch (e: unknown) {
          message.error(apiErrorMessage(e, 'Could not save the scope'));
        } finally {
          setSaving(false);
        }
      },
    });
  }

  async function trigger(mode: TriggerableSyncMode) {
    try {
      await api.triggerSync(mode);
      message.success(`${MODE_LABEL[mode]} started`);
      reload();
    } catch (e: unknown) {
      message.error(apiErrorMessage(e, 'Could not start the sync'));
    }
  }

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  const categories = (scope?.categories ?? []).filter((c) =>
    c.fullName.toLowerCase().includes(categoryFilter.trim().toLowerCase()));
  const warehouses = (scope?.warehouses ?? []).filter((w) =>
    w.name.toLowerCase().includes(warehouseFilter.trim().toLowerCase()));

  const categoryColumns: ColumnsType<SellfoxCategory> = [
    {
      title: 'Import',
      width: 80,
      render: (_, row) => (
        <Checkbox
          checked={draftCategories.has(row.cid)}
          onChange={(e) => {
            const next = new Set(draftCategories);
            if (e.target.checked) next.add(row.cid); else next.delete(row.cid);
            setDraftCategories(next);
          }}
        />
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
      width: 110,
      render: (_, row) => (
        <Checkbox
          checked={draftWarehouses.has(row.warehouseId)}
          onChange={(e) => {
            const next = new Set(draftWarehouses);
            if (e.target.checked) next.add(row.warehouseId); else next.delete(row.warehouseId);
            setDraftWarehouses(next);
          }}
        />
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
      title: 'Run',
      width: 175,
      render: (_, run) => (
        <Space size={4} wrap>
          <Tag
            color={STATUS_COLOR[run.status]}
            icon={run.status === 'RUNNING' ? <SyncOutlined spin /> : undefined}
          >
            {run.status}
          </Tag>
          {/* Full and stock-only runs share a table; without this a "0 products" line
              cannot be told from a run that never looked at the catalog. */}
          <Tag color={MODE_COLOR[run.mode]}>{MODE_LABEL[run.mode]}</Tag>
        </Space>
      ),
    },
    { title: 'Started', dataIndex: 'startedAt', width: 180, render: (iso: string) => formatTime(iso) },
    { title: 'Took', width: 80, render: (_, run) => formatDuration(run) },
    {
      title: 'Trigger',
      width: 165,
      render: (_, run) => (
        <Space size={2} direction="vertical">
          <Tag color={run.trigger === 'SCHEDULED' ? 'default' : 'purple'}>
            {TRIGGER_LABEL[run.trigger]}
          </Tag>
          {run.triggeredBy && <Text type="secondary" style={{ fontSize: 11 }}>{run.triggeredBy}</Text>}
        </Space>
      ),
    },
    {
      title: 'Records',
      width: 175,
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
      <PageHeader
        title="Sellfox Sync"
        actions={
          <>
          <Tooltip title="Stock only, for the warehouses in scope. A few seconds.">
            <span>
              <Button onClick={() => trigger('INVENTORY')} disabled={running || !configured}>
                Refresh stock
              </Button>
            </span>
          </Tooltip>
          <Tooltip
            title={
              configured
                ? 'Re-imports the whole scope and deactivates anything that has left it. Around two minutes.'
                : discovered
                  ? 'Set the import scope first'
                  : 'Fills in the category and warehouse lists so the scope can be set'
            }
          >
            {/* A disabled button swallows hover, so the tooltip needs a wrapper. */}
            <span>
              <Button
                type="primary"
                icon={<CloudDownloadOutlined />}
                onClick={() => trigger('FULL')}
                loading={running}
                disabled={running || (discovered && !configured)}
              >
                {running ? 'Syncing…' : configured ? 'Full sync' : 'Discover lists'}
              </Button>
            </span>
          </Tooltip>
          </>
        }
      />

      <Paragraph type="secondary" style={{ fontSize: 13, marginTop: -8 }}>
        Sellfox is the system of record for what a product is and how many there are. The
        import scope is set once and then left alone — stock refreshes <b>hourly</b> and
        the whole catalog re-imports <b>nightly</b>. Imported products arrive{' '}
        <b>hidden</b>, priced by their tier's standing discount off the list price Sellfox
        supplies. Check the price, then make them visible.
      </Paragraph>

      {editing ? (
        <Card
          size="small"
          title="Change import scope"
          className="section-card section-card--sync"
          extra={
            <Space>
              <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
              <Tooltip title={draftReady ? undefined : 'Pick at least one of each'}>
                <span>
                  <Button
                    size="small"
                    type="primary"
                    loading={saving}
                    disabled={!draftReady}
                    onClick={saveScope}
                  >
                    Save and sync
                  </Button>
                </span>
              </Tooltip>
            </Space>
          }
        >
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 440px', minWidth: 400 }}>
              <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                <Text strong>
                  Categories{' '}
                  <Text type="secondary" style={{ fontWeight: 400 }}>
                    — {draftCategories.size} of {scope?.categories.length ?? 0}
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
                    disabled={draftCategories.size === 0}
                    onClick={() => setDraftCategories(new Set())}
                  >
                    Clear
                  </Button>
                </Space>
              </Space>

              {scope?.categories.length === 0 ? (
                <Empty description="Run a sync to discover them" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                Chosen at the second level of Sellfox's tree — a group takes everything
                beneath it.
              </Text>
            </div>

            <div style={{ flex: '1 1 400px', minWidth: 360 }}>
              <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                <Text strong>
                  Warehouses{' '}
                  <Text type="secondary" style={{ fontWeight: 400 }}>
                    — {draftWarehouses.size} of {scope?.warehouses.length ?? 0}
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
                    disabled={draftWarehouses.size === 0}
                    onClick={() => setDraftWarehouses(new Set())}
                  >
                    Clear
                  </Button>
                </Space>
              </Space>

              {scope?.warehouses.length === 0 ? (
                <Empty description="Run a sync to discover them" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                A SKU's stock is the sum across these.
              </Text>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          size="small"
          title="Import scope"
          className="section-card"
          extra={
            <Tooltip title={running ? 'Wait for the running sync to finish' : undefined}>
              <span>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={startEditing}
                  disabled={running || !discovered}
                >
                  Change
                </Button>
              </span>
            </Tooltip>
          }
        >
          {configured ? (
            <Descriptions size="small" column={1} colon={false}>
              <Descriptions.Item
                label={
                  <Text type="secondary">
                    {plural(selectedCategories.length, 'category', 'categories')}
                  </Text>
                }
              >
                <Space size={[4, 4]} wrap>
                  {selectedCategories.map((c) => (
                    <Tag key={c.cid} color="blue">{c.fullName} · {c.commodityCount}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Text type="secondary">
                    {plural(selectedWarehouses.length, 'warehouse', 'warehouses')}
                  </Text>
                }
              >
                <Space size={[4, 4]} wrap>
                  {selectedWarehouses.map((w) => (
                    <Tag key={w.warehouseId} color="geekblue">{w.name}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">
              {discovered
                ? 'Not set yet. Choose the categories to import and the warehouses to count stock in.'
                : 'Nothing discovered yet — run a sync to fill in the lists, then set the scope.'}
            </Text>
          )}
        </Card>
      )}

      <Card size="small" title="Run history" className="section-card">
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
