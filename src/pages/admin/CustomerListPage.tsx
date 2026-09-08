import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Button, Space, Tag, Typography, Switch, message } from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as api from '../../api/adminApi';
import type { Customer } from '../../api/types';
import { usePagedQuery } from '../../hooks/usePagedQuery';

const { Title } = Typography;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
];

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, loading, page, setPage, reload } = usePagedQuery(
    (f, p) => api.fetchCustomers({ ...f, page: p }),
    { search, status: statusFilter }
  );

  async function toggleStatus(customer: Customer) {
    const newStatus = customer.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    await api.updateCustomer(customer.id, { status: newStatus });
    message.success(`Account ${newStatus === 'ACTIVE' ? 'enabled' : 'disabled'}`);
    reload();
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
      title: 'Actions', key: 'actions', width: 80,
      render: (_: unknown, r: Customer) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/customers/${r.id}/edit`)} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Customers</Title>
        <Space>
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
        </Space>
      </div>

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
    </div>
  );
}
