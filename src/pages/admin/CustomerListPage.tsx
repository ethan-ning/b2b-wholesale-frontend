import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Input, Select, Button, Card, Space, Tag, Typography, Switch, message, Modal, Alert, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined, KeyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type { Customer } from '../../api/types';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import PageHeader from '../../components/admin/PageHeader';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
];

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Held only until the admin dismisses it. The server keeps a hash, so this is the one
  // moment the password exists anywhere it can be read.
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const { data, loading, error, page, setPage, reload } = usePagedQuery(
    (f, p) => api.fetchCustomers({ ...f, page: p }),
    { search, status: statusFilter }
  );

  async function toggleStatus(customer: Customer) {
    const newStatus = customer.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    // The API takes the whole profile rather than a patch — an update states what the
    // dealer's details now are, so the unchanged fields are sent back as they stand.
    await api.updateCustomer(customer.id, {
      name: customer.name,
      companyName: customer.companyName,
      tierId: customer.tierId,
      phone: customer.phone,
      status: newStatus,
    });
    message.success(`Account ${newStatus === 'ACTIVE' ? 'enabled' : 'disabled'}`);
    reload();
  }

  /**
   * Resetting is destructive in a way a disabled button cannot express: it invalidates
   * whatever the dealer is using right now, so they are locked out until someone reads
   * them the new one. Hence the confirm, and hence the warning naming the dealer.
   */
  function confirmReset(customer: Customer) {
    Modal.confirm({
      title: 'Reset this dealer\'s password?',
      okText: 'Reset password',
      okButtonProps: { danger: true },
      content: (
        <>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            <b>{customer.name}</b> ({customer.email}) will be signed out of their current
            password immediately.
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            A new temporary one is generated and shown once. They will be asked to choose
            their own at next login.
          </Typography.Paragraph>
        </>
      ),
      onOk: async () => {
        try {
          const result = await api.resetCustomerPassword(customer.id);
          setIssued({ email: customer.email, password: result.temporaryPassword });
          reload();
        } catch {
          message.error('Could not reset the password.');
        }
      },
    });
  }

  const columns: ColumnsType<Customer> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Company', dataIndex: 'companyName', key: 'company' },
    {
      title: 'Tier', dataIndex: 'tierName', key: 'tier', width: 80,
      render: (v: string) => <Tag color={v === 'Gold' ? 'gold' : 'default'}>{v}</Tag>,
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 110, render: (v: string | null) => v ?? '—' },
    {
      title: 'Status', key: 'status', width: 100,
      render: (_: unknown, r: Customer) => (
        <Switch
          checked={r.status === 'ACTIVE'}
          checkedChildren="Active"
          unCheckedChildren="Off"
          onChange={() => toggleStatus(r)}
          size="small"
        />
      ),
    },
    {
      title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 110,
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_: unknown, r: Customer) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/admin/customers/${r.id}/edit`)}
            />
          </Tooltip>
          <Tooltip title="Reset password">
            <Button size="small" icon={<KeyOutlined />} onClick={() => confirmReset(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Not dismissible by clicking away: closing this loses the only copy. */}
      <Modal
        open={issued !== null}
        title="New temporary password"
        closable={false}
        maskClosable={false}
        onOk={() => setIssued(null)}
        okText="Done"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Alert
          type="warning"
          showIcon
          message="Copy this password now"
          description={
            `It is stored only as a hash, so it cannot be shown again. Give it to `
            + `${issued?.email ?? 'the dealer'}, who will be asked to change it at next login.`
          }
          style={{ marginBottom: 12 }}
        />
        <Typography.Paragraph copyable strong style={{ fontSize: 18, textAlign: 'center' }}>
          {issued?.password}
        </Typography.Paragraph>
      </Modal>

      <PageHeader
        title="Customers"
        subtitle="Dealer accounts and the tier that decides what each of them pays."
        actions={
          <>
            <Input
              placeholder="Search name, email, company..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 260 }}
            />
            <Select
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 130 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/customers/new')}>
              New Customer
            </Button>
          </>
        }
      />

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
      <Card size="small" className="section-card section-card--people">
      <Table<Customer>
        columns={columns}
        dataSource={data?.content ?? []}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page + 1,
          total: data?.totalElements ?? 0,
          pageSize: 10,
          onChange: (p) => setPage(p - 1),
          showTotal: (t) => `${t} customers`,
        }}
        size="small"
      />
      </Card>
    </div>
  );
}
