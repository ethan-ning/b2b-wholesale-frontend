import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Space, Typography, Badge, theme } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ApartmentOutlined,
  TeamOutlined,
  InboxOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAdminAuthStore } from '../../store/adminAuthStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const NAV_ITEMS = [
  { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/products', icon: <ShoppingOutlined />, label: 'Products' },
  { key: '/admin/categories', icon: <ApartmentOutlined />, label: 'Categories' },
  { key: '/admin/customers', icon: <TeamOutlined />, label: 'Customers' },
  { key: '/admin/inventory', icon: <InboxOutlined />, label: 'Inventory' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, adminLogout } = useAdminAuthStore();
  const { token: designToken } = theme.useToken();

  const selectedKey = NAV_ITEMS.slice()
    .reverse()
    .find((item) => location.pathname.startsWith(item.key))?.key ?? '/admin';

  function handleLogout() {
    adminLogout();
    navigate('/admin/login');
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={220}
        style={{ background: designToken.colorBgContainer }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            borderBottom: `1px solid ${designToken.colorBorderSecondary}`,
            gap: 8,
          }}
        >
          <ShoppingOutlined style={{ fontSize: 20, color: designToken.colorPrimary }} />
          {!collapsed && (
            <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
              Admin Panel
            </Text>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 4 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: designToken.colorBgContainer,
            borderBottom: `1px solid ${designToken.colorBorderSecondary}`,
            padding: '0 24px',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space>
            <Badge
              count={admin?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN'}
              style={{
                background: admin?.role === 'SUPER_ADMIN' ? '#722ed1' : '#1677ff',
                fontSize: 10,
              }}
            />
            <Text>{admin?.name}</Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
