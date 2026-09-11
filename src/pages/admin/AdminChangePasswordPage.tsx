import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authFailureMessage } from '../../api/http';
import { changeOwnPassword } from '../../api/adminApi';
import { useAdminAuthStore } from '../../store/adminAuthStore';

const { Title, Text } = Typography;

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Where an admin lands while they are still on a password somebody else generated.
 *
 * Not merely a prompt: the token they arrive with reaches only this endpoint, so the back
 * office is genuinely closed until they finish. Completing it swaps in a full session.
 */
export default function AdminChangePasswordPage() {
  const navigate = useNavigate();
  const admin = useAdminAuthStore((s) => s.admin);
  const adminLogin = useAdminAuthStore((s) => s.adminLogin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      const data = await changeOwnPassword(values.currentPassword, values.newPassword);
      adminLogin(data.token, data.admin);
      navigate('/admin', { replace: true });
    } catch (e: unknown) {
      setError(authFailureMessage(e, 'Could not change your password.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f6f8',
        padding: 24,
      }}
    >
      <Card style={{ width: 400 }}>
        <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center', marginBottom: 20 }}>
          <LockOutlined style={{ fontSize: 28, color: '#722ed1' }} />
          <Title level={4} style={{ margin: 0 }}>Choose a password</Title>
          <Text type="secondary">
            {admin?.email} was set up with a temporary password. Pick your own to continue.
          </Text>
        </Space>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} autoComplete="off">
          <Form.Item
            name="currentPassword"
            label="Temporary password"
            rules={[{ required: true, message: 'Enter the password you were given' }]}
          >
            <Input.Password prefix={<LockOutlined />} size="large" autoComplete="current-password" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="New password"
            rules={[
              { required: true, message: 'Enter a new password' },
              { min: 8, message: 'At least 8 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} size="large" autoComplete="new-password" />
          </Form.Item>

          {/* Checked here only: the API takes one password, and a typo it cannot see is
              exactly what this field is for. */}
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
            <Input.Password prefix={<LockOutlined />} size="large" autoComplete="new-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Set password and continue
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
