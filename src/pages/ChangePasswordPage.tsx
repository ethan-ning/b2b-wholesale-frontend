import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authFailureMessage } from '../api/http';
import { changePassword } from '../api/catalog';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

/**
 * Where a dealer lands when they are still on the password an admin generated.
 *
 * Not merely a prompt: the token they arrive with reaches only this endpoint, so the
 * catalog is genuinely closed until they finish. Completing it swaps in a full token.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: { currentPassword: string; newPassword: string }) {
    setLoading(true);
    setError(null);
    try {
      const data = await changePassword(token!, values.currentPassword, values.newPassword);
      login(data.token, data.user);
      navigate('/', { replace: true });
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
        background: '#f0f2f5',
        padding: 24,
      }}
    >
      <Card style={{ width: 380 }}>
        <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center', marginBottom: 16 }}>
          <LockOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>Choose a password</Title>
          <Text type="secondary">
            Your account was created with a temporary password. Pick your own to continue.
          </Text>
        </Space>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="currentPassword"
            label="Temporary password"
            rules={[{ required: true, message: 'Enter the password you were given' }]}
          >
            <Input.Password autoFocus />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New password"
            rules={[
              { required: true, message: 'Choose a password' },
              { min: 8, message: 'At least 8 characters' },
              { max: 72, message: 'At most 72 characters' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm new password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Repeat the password' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('The two passwords do not match')),
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Set password
          </Button>
        </Form>
      </Card>
    </div>
  );
}
