import { useState } from 'react';
import { Alert, Button, Card, Descriptions, Form, Input, Space, Tag, Typography, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import PageHeader from '../../components/admin/PageHeader';
import { changeOwnPassword } from '../../api/adminApi';
import { authFailureMessage } from '../../api/http';
import { useAdminAuthStore } from '../../store/adminAuthStore';

const { Text } = Typography;

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * The signed-in admin's own account. Read-only except the password: an email change is
 * an identity change and a role change belongs to a super admin, so neither is here.
 */
export default function AdminAccountPage() {
  const admin = useAdminAuthStore((s) => s.admin);
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: FormValues) {
    setSaving(true);
    setError(null);
    try {
      await changeOwnPassword(values.currentPassword, values.newPassword);
      form.resetFields();
      message.success('Password changed.');
    } catch (e) {
      setError(authFailureMessage(e, 'Could not change the password.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="My account" subtitle="Your sign-in details for the admin portal." />

      <Space direction="vertical" size={16} style={{ width: '100%', maxWidth: 720 }}>
        <Card className="section-card" title="Identity">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Name">{admin?.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{admin?.email}</Descriptions.Item>
            <Descriptions.Item label="Role">
              <Tag color={admin?.role === 'SUPER_ADMIN' ? 'purple' : 'blue'}>
                {admin?.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card className="section-card" title="Change password">
          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

          <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
            <Form.Item
              name="currentPassword"
              label="Current password"
              rules={[{ required: true, message: 'Enter your current password' }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="New password"
              rules={[
                { required: true, message: 'Enter a new password' },
                { min: 8, message: 'At least 8 characters' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>

            {/* Confirmation is checked here only. The API takes one password; a typo the
                server cannot see is exactly what this field is for. */}
            <Form.Item
              name="confirmPassword"
              label="Confirm new password"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Repeat the new password' },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    !value || getFieldValue('newPassword') === value
                      ? Promise.resolve()
                      : Promise.reject(new Error('The two passwords do not match')),
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                Change password
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                You stay signed in on this device.
              </Text>
            </Space>
          </Form>
        </Card>
      </Space>
    </>
  );
}
