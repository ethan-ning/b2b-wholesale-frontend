import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Space } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { login as loginRequest } from '../api/catalog';
import { authFailureMessage } from '../api/http';
import { useAuthStore } from '../store/authStore';
import { BRAND, LOGO_MARK } from '../brand';
import DealerTheme from '../components/DealerTheme';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      const data = await loginRequest(values.email, values.password);
      login(data.token, data.user);
      // The token they just received reaches only the change-password endpoint, so this
      // is the only page that will work for them.
      navigate(data.user.mustChangePassword ? '/change-password' : '/');
    } catch (e: unknown) {
      setError(authFailureMessage(e, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DealerTheme>
      <div className="login-split">
        {/*
         * The brand half. A dealer arrives here before anything else in the portal, and a
         * centred card on grey said nothing about whose portal it is. Hidden on narrow
         * screens, where it would push the form below the fold.
         */}
        <aside className="login-brand">
          <div className="login-brand-scrim" />
          <div className="login-brand-body">
            <img src={LOGO_MARK} alt="" className="login-mark" />
            <Title level={2} style={{ color: '#fff', margin: '20px 0 8px', letterSpacing: '0.01em' }}>
              WOLTAPHOR
            </Title>
            <Text style={{ color: BRAND.amber, letterSpacing: '0.16em', fontSize: 12, fontWeight: 600 }}>
              WHOLESALE DEALER PORTAL
            </Text>
            <Text style={{ color: BRAND.silverDim, display: 'block', marginTop: 24, maxWidth: 340 }}>
              Heavy-duty truck parts and accessories, priced at your dealer tier.
            </Text>
          </div>
        </aside>

        {/* The form half. */}
        <main className="login-form-side">
          <div style={{ width: '100%', maxWidth: 380 }}>
            <img src={LOGO_MARK} alt="Woltaphor" className="login-mark-compact" />

            <Title level={3} style={{ margin: '0 0 4px' }}>
              Dealer sign in
            </Title>
            <Text type="secondary">Use the account your sales representative set up.</Text>

            <div style={{ height: 24 }} />

            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

            <Form layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#9aa3ad' }} />}
                  placeholder="dealer@example.com"
                  size="large"
                  autoComplete="username"
                />
              </Form.Item>
              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: 'Password is required' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9aa3ad' }} />}
                  placeholder="Password"
                  size="large"
                  autoComplete="current-password"
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                  Sign in
                </Button>
              </Form.Item>
            </Form>

            <Space direction="vertical" size={4} style={{ marginTop: 24 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                No account? Contact your sales representative.
              </Text>
            </Space>
          </div>
        </main>
      </div>
    </DealerTheme>
  );
}
