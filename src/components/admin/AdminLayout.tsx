import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Space, Typography, Tag, Tooltip, ConfigProvider } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ApartmentOutlined,
  TeamOutlined,
  InboxOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CloudSyncOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAdminAuthStore } from '../../store/adminAuthStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const DASHBOARD = { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' };

/** What the catalogue is made of. The three screens that answer "what do we sell". */
const CATALOGUE = [
  { key: '/admin/products', icon: <ShoppingOutlined />, label: 'Products' },
  { key: '/admin/categories', icon: <ApartmentOutlined />, label: 'Categories' },
  { key: '/admin/inventory', icon: <InboxOutlined />, label: 'Inventory' },
];

/** Who can sign in. Both are account management, so they sit together. */
const ACCOUNTS = [
  { key: '/admin/customers', icon: <TeamOutlined />, label: 'Dealers' },
  { key: '/admin/admins', icon: <SafetyCertificateOutlined />, label: 'Admins' },
];

/**
 * Last, under its own heading. It is not a place you go to look something up — it is the
 * machinery that fills everything above it, visited rarely and deliberately.
 */
const SYNC = { key: '/admin/sellfox', icon: <CloudSyncOutlined />, label: 'Sellfox Sync' };

const ROUTES = [DASHBOARD, ...CATALOGUE, ...ACCOUNTS, SYNC];

const SIDEBAR_BG = '#0f172a';
const SIDEBAR_EDGE = 'rgba(148, 163, 184, 0.16)';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, adminLogout } = useAdminAuthStore();

  /**
   * Longest matching prefix, with /admin exact — otherwise Dashboard, whose key is a
   * prefix of every other route, would light up on all of them. A path with no nav entry
   * of its own (My account) deliberately highlights nothing rather than the wrong thing.
   */
  const selectedKey =
    location.pathname === '/admin'
      ? '/admin'
      : ROUTES.filter((r) => r.key !== '/admin' && location.pathname.startsWith(r.key))
          .sort((a, b) => b.key.length - a.key.length)[0]?.key;

  const isSuper = admin?.role === 'SUPER_ADMIN';

  function handleLogout() {
    adminLogout();
    navigate('/admin/login');
  }

  // Group headings only when there is room to read them. Collapsed, they become slivers
  // of nothing between the icons.
  const mainItems = collapsed
    ? [DASHBOARD, ...CATALOGUE, ...ACCOUNTS, { type: 'divider' as const, key: 'd-sync' }, SYNC]
    : [
        DASHBOARD,
        { type: 'group' as const, key: 'g-catalogue', label: 'Catalogue', children: CATALOGUE },
        { type: 'group' as const, key: 'g-accounts', label: 'Accounts', children: ACCOUNTS },
        { type: 'group' as const, key: 'g-system', label: 'System', children: [SYNC] },
      ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkPopupBg: SIDEBAR_BG,
            darkItemColor: '#94a3b8',
            darkItemHoverColor: '#f1f5f9',
            darkItemHoverBg: 'rgba(148, 163, 184, 0.10)',
            darkItemSelectedBg: 'rgba(59, 130, 246, 0.20)',
            darkItemSelectedColor: '#ffffff',
            darkGroupTitleColor: '#64748b',
            itemHeight: 38,
            itemMarginInline: 8,
            itemBorderRadius: 6,
          },
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          className="admin-sider"
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={224}
          collapsedWidth={72}
          style={{ background: SIDEBAR_BG, position: 'sticky', top: 0, height: '100vh' }}
        >
          {/* Brand */}
          <div
            style={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 18px',
              borderBottom: `1px solid ${SIDEBAR_EDGE}`,
              gap: 10,
              flexShrink: 0,
            }}
          >
            <ShoppingOutlined style={{ fontSize: 19, color: '#60a5fa' }} />
            {!collapsed && (
              <Text
                strong
                style={{ fontSize: 14, color: '#f1f5f9', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}
              >
                Woltaphor B2B
              </Text>
            )}
          </div>

          {/* Everything you look things up in. Scrolls if it ever outgrows the window. */}
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8, minHeight: 0 }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={selectedKey ? [selectedKey] : []}
              items={mainItems}
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 0, background: 'transparent' }}
            />
          </div>

          {/*
           * The collapse control lives in the sidebar, at its foot, spanning its full
           * width. In the header it sat a few pixels from the collapsed rail and read as
           * part of it — an orphaned icon belonging to neither side.
           */}
          <div
            style={{
              borderTop: `1px solid ${SIDEBAR_EDGE}`,
              padding: 8,
              flexShrink: 0,
            }}
          >
            <Tooltip title={collapsed ? 'Expand sidebar' : undefined} placement="right">
              <Button
                type="text"
                block
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setCollapsed(!collapsed)}
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                style={{
                  color: '#94a3b8',
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: 10,
                  paddingInline: collapsed ? 0 : 12,
                }}
              >
                {!collapsed && 'Collapse'}
              </Button>
            </Tooltip>
          </div>
        </Sider>

        <Layout>
          <Header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              background: '#ffffff',
              borderBottom: '1px solid #e3e8ef',
              padding: '0 20px',
              height: 60,
              lineHeight: 'normal',
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
            }}
          >
            <Space size={10}>
              {/* A Tag, not a Badge: this labels who you are, it does not count anything. */}
              <Tag
                color={isSuper ? 'purple' : 'blue'}
                style={{ marginInlineEnd: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}
              >
                {isSuper ? 'SUPER ADMIN' : 'ADMIN'}
              </Tag>
              <Button
                type="text"
                icon={<UserOutlined />}
                onClick={() => navigate('/admin/account')}
                style={{ color: '#334155', fontWeight: 500 }}
              >
                {admin?.name}
              </Button>
              <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} style={{ color: '#64748b' }}>
                Sign out
              </Button>
            </Space>
          </Header>

          <Content style={{ margin: 24, minHeight: 280 }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
