import { useState } from 'react';
import {
  Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message,
} from 'antd';
import { DeleteOutlined, PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import PageHeader from '../../components/admin/PageHeader';
import { PageError, PageLoading } from '../../components/PageState';
import { createAdmin, deleteAdmin, fetchAdmins } from '../../api/adminApi';
import { apiErrorMessage } from '../../api/http';
import { useAdminAuthStore } from '../../store/adminAuthStore';
import { useResource } from '../../hooks/useResource';
import type { AdminUser } from '../../api/types';

const { Text, Paragraph } = Typography;

interface NewAdminValues {
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
}

/**
 * The admin roster. Everyone can see who holds the keys; only a super admin can change
 * the list — the server enforces that, and hiding the buttons here only spares an admin
 * from clicking something that would be refused.
 */
export default function AdminUsersPage() {
  const me = useAdminAuthStore((s) => s.admin);
  const canManage = me?.role === 'SUPER_ADMIN';

  /*
   * useResource rather than a hand-rolled load: it drops a response whose request has
   * been superseded, and stops when the page unmounts. Without that, navigating away
   * mid-load left React flushing a state update into a component that no longer existed
   * — invisible in a browser, and an uncaught "window is not defined" once the test
   * environment had been torn down underneath it.
   */
  const { data: admins, loading, error, reload } = useResource(() => fetchAdmins(), []);

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [form] = Form.useForm<NewAdminValues>();

  async function onCreate(values: NewAdminValues) {
    setSaving(true);
    setFormError(null);
    try {
      const result = await createAdmin(values);
      setAdding(false);
      form.resetFields();
      // Shown once, then gone — the server keeps only a hash.
      setCreated({ email: result.admin.email, password: result.temporaryPassword });
      reload();
    } catch (e) {
      setFormError(apiErrorMessage(e, 'Could not create the admin.'));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(target: AdminUser) {
    try {
      await deleteAdmin(target.id);
      message.success(`Removed ${target.email}.`);
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not remove that admin.'));
    }
  }

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name: string, row: AdminUser) => (
        <Space size={8}>
          <Text strong>{name}</Text>
          {row.id === me?.id && <Tag>You</Tag>}
        </Space>
      ),
    },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Role',
      dataIndex: 'role',
      width: 140,
      render: (role: AdminUser['role']) => (
        <Tag color={role === 'SUPER_ADMIN' ? 'purple' : 'blue'}>
          {role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}
        </Tag>
      ),
    },
    ...(canManage
      ? [{
          title: '',
          key: 'actions',
          width: 100,
          render: (_: unknown, row: AdminUser) =>
            row.id === me?.id ? null : (
              <Popconfirm
                title={`Remove ${row.email}?`}
                description="They lose access immediately. This cannot be undone."
                okText="Remove"
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(row)}
              >
                <Button size="small" danger type="text" icon={<DeleteOutlined />}>
                  Remove
                </Button>
              </Popconfirm>
            ),
        }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Admins"
        subtitle={
          canManage
            ? 'Only a super admin can add or remove admins.'
            : 'Adding and removing admins is reserved for super admins.'
        }
        actions={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setFormError(null); setAdding(true); }}>
              Add admin
            </Button>
          )
        }
      />

      <Card className="section-card" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          dataSource={admins ?? []}
          columns={columns}
          pagination={false}
          size="middle"
        />
      </Card>

      <Modal
        open={adding}
        title={<Space><UserAddOutlined />Add admin</Space>}
        okText="Create"
        confirmLoading={saving}
        onCancel={() => setAdding(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        {formError && <Alert type="error" message={formError} showIcon style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={onCreate} requiredMark={false} initialValues={{ role: 'ADMIN' }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Enter a name' }]}
          >
            <Input placeholder="Jane Smith" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
          >
            <Input placeholder="jane@example.com" />
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Select
              options={[
                { value: 'ADMIN', label: 'Admin — everything except managing admins' },
                { value: 'SUPER_ADMIN', label: 'Super admin — can also add and remove admins' },
              ]}
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            A password is generated and shown once. Pass it on yourself.
          </Text>
        </Form>
      </Modal>

      <Modal
        open={created !== null}
        title="Admin created"
        onCancel={() => setCreated(null)}
        onOk={() => setCreated(null)}
        okText="Done"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Paragraph>
          Give <Text strong>{created?.email}</Text> this password. It is not stored and cannot be
          shown again — if it is lost, remove the account and create it anew.
        </Paragraph>
        <Paragraph copyable={{ text: created?.password }}>
          <Text code style={{ fontSize: 16 }}>{created?.password}</Text>
        </Paragraph>
      </Modal>
    </>
  );
}
