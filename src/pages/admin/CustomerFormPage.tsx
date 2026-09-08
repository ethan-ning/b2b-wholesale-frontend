import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, Button, Card, Typography, Space, Spin, Alert, Divider, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import adminClient from '../../api/adminClient';
import type { Customer, CustomerTier } from '../../api/types';

const { Title } = Typography;
const isNew = (id: string | undefined) => id === 'new' || id === undefined;

export default function CustomerFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [tiers, setTiers] = useState<CustomerTier[]>([]);
  const [loading, setLoading] = useState(!isNew(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = isNew(id);

  useEffect(() => {
    const p: Promise<unknown>[] = [
      adminClient.get<CustomerTier[]>('/admin/tiers').then(({ data }) => setTiers(data)),
    ];
    if (!creating) {
      p.push(
        adminClient.get<Customer>(`/admin/customers/${id}`).then(({ data }) => {
          form.setFieldsValue({
            email: data.email,
            name: data.name,
            companyName: data.companyName,
            tierId: data.tierId,
            phone: data.phone,
            status: data.status,
          });
        })
      );
    }
    Promise.all(p)
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  }, [id, creating, form]);

  async function onFinish(values: {
    email: string; name: string; companyName: string;
    tierId: number; phone: string; status?: string;
  }) {
    setSaving(true);
    try {
      if (creating) {
        await adminClient.post('/admin/customers', values);
        message.success('Customer created');
      } else {
        await adminClient.put(`/admin/customers/${id}`, values);
        message.success('Customer updated');
      }
      navigate('/admin/customers');
    } catch {
      message.error('Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div style={{ maxWidth: 600 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/customers')}>
          Back
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {creating ? 'New Customer' : 'Edit Customer'}
        </Title>
      </Space>

      <Card size="small">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="dealer@company.com" disabled={!creating} />
          </Form.Item>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="companyName" label="Company Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tierId" label="Tier" rules={[{ required: true }]}>
            <Select
              options={tiers.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select tier"
            />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="555-1234" />
          </Form.Item>
          {!creating && (
            <Form.Item name="status" label="Status">
              <Select options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'DISABLED', label: 'Disabled' },
              ]} />
            </Form.Item>
          )}
          {creating && (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
              A temporary password will be generated. The dealer will be required to change it on first login.
            </Typography.Text>
          )}
          <Divider />
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              {creating ? 'Create Customer' : 'Save Changes'}
            </Button>
            <Button onClick={() => navigate('/admin/customers')}>Cancel</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
