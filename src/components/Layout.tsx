import { useNavigate, Outlet, useSearchParams } from 'react-router-dom';
import { Layout as AntLayout, Input, Button, Space, Typography } from 'antd';
import { LogoutOutlined, SearchOutlined, ShopOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

const { Header, Content } = AntLayout;
const { Text } = Typography;

export default function Layout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuthStore();

  function handleSearch(value: string) {
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value.trim())}`);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const currentQuery = searchParams.get('q') ?? '';

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
          background: '#001529',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Space
          style={{ cursor: 'pointer', marginRight: 24 }}
          onClick={() => navigate('/')}
        >
          <ShopOutlined style={{ color: '#fff', fontSize: 20 }} />
          <Text strong style={{ color: '#fff', fontSize: 16 }}>
            B2B Wholesale
          </Text>
        </Space>

        <Input.Search
          placeholder="Search products by name, SKU, or brand..."
          defaultValue={currentQuery}
          key={currentQuery}
          onSearch={handleSearch}
          enterButton={<SearchOutlined />}
          style={{ flex: 1, maxWidth: 600 }}
          allowClear
        />

        <Space style={{ marginLeft: 'auto' }}>
          <Text style={{ color: '#ffffffa0' }}>
            {user?.name} · <Text style={{ color: '#1677ff' }}>{user?.tierName}</Text>
          </Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            style={{ color: '#fff' }}
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </Space>
      </Header>

      <Content>
        <Outlet />
      </Content>
    </AntLayout>
  );
}
