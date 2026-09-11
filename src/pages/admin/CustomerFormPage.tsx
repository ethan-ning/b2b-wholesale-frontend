import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Form, Input, Select, Button, Card, Typography, Space, Divider, Modal, message } from 'antd';
import * as api from '../../api/adminApi';
import PageHeader from '../../components/admin/PageHeader';
import { PageError, PageLoading } from '../../components/PageState';
import type { Customer, CustomerTier } from '../../api/types';

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
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const p: Promise<unknown>[] = [
      api.fetchTiers().then((t) => { if (current) setTiers(t); }),
    ];
    if (!creating) {
      p.push(
        api.fetchCustomer(id!).then((data) => {
          if (!current) return;
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
      .catch(() => { if (current) setError('Failed to load.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, creating, form]);

  async function onFinish(values: {
    email: string; name: string; companyName: string;
    tierId: number; phone: string; status?: Customer['status'];
  }) {
    setSaving(true);
    try {
      if (creating) {
        const created = await api.createCustomer(values);
        // The API returns the generated password once and only once — it is stored as a
        // hash, so navigating away without showing it loses it for good.
        setIssuedPassword(created.temporaryPassword);
        return;
      }
      await api.updateCustomer(id!, values);
      message.success('Customer updated');
      navigate('/admin/customers');
    } catch {
      message.error('Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  return (
    <div style={{ maxWidth: 600 }}>
      <PageHeader
        title={creating ? 'New Customer' : 'Edit Customer'}
        backTo="/admin/customers"
        backLabel="Back to Customers"
      />

      <Card size="small" className="section-card section-card--people">
        <Modal
          open={issuedPassword !== null}
          title="Dealer created"
          closable={false}
          maskClosable={false}
          onOk={() => navigate('/admin/customers')}
          okText="Done"
          cancelButtonProps={{ style: { display: 'none' } }}
        >
          <Alert
            type="warning"
            showIcon
            message="Copy this password now"
            description="It is stored only as a hash, so it cannot be shown again. The dealer must change it at first login."
            style={{ marginBottom: 12 }}
          />
          <Typography.Paragraph copyable strong style={{ fontSize: 18, textAlign: 'center' }}>
            {issuedPassword}
          </Typography.Paragraph>
        </Modal>

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
