import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { login } from '../../api/adminApi';
import { useAdminAuthStore } from '../../store/adminAuthStore';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
  password: string;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const adminLogin = useAdminAuthStore((s) => s.adminLogin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      const data = await login(values.email, values.password);
      adminLogin(data.token, data.admin);
      navigate('/admin');
    } catch {
      setError('Invalid email or password.');
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
      }}
    >
      <Card style={{ width: 380, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size={24} style={{ width: '100%', textAlign: 'center' }}>
          <Space direction="vertical" size={4}>
            <LockOutlined style={{ fontSize: 40, color: '#722ed1' }} />
            <Title level={3} style={{ margin: 0 }}>
              Admin Portal
            </Title>
            <Text type="secondary">B2B Wholesale Management</Text>
          </Space>

          {error && <Alert type="error" message={error} showIcon />}

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
            >
              <Input placeholder="admin@example.com" size="large" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password placeholder="Password" size="large" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                Sign in
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
