import { useNavigate, Outlet, useSearchParams } from 'react-router-dom';
import { Layout as AntLayout, Input, Button, Space, Typography, Tag, Tooltip } from 'antd';
import { LogoutOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { BRAND, LOGO_HORIZONTAL } from '../brand';
import DealerTheme from './DealerTheme';

const { Header, Content, Footer } = AntLayout;
const { Text } = Typography;

export default function Layout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuthStore();

  function handleSearch(value: string) {
    const term = value.trim();
    // An empty term is a real intent — clearing the box (or submitting it empty)
    // means "show me everything", not "do nothing".
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const currentQuery = searchParams.get('q') ?? '';

  return (
    <DealerTheme>
      <AntLayout style={{ minHeight: '100vh', background: '#f6f7f9' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            padding: '0 24px',
            height: 68,
            // The logo's own backdrop, so the artwork has no visible edge against the bar.
            background: BRAND.ink,
            borderBottom: `1px solid ${BRAND.inkLine}`,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Tooltip title="Woltaphor home">
            <img
              src={LOGO_HORIZONTAL}
              alt="Woltaphor"
              onClick={() => navigate('/')}
              style={{ height: 44, cursor: 'pointer', display: 'block', flexShrink: 0, borderRadius: 4 }}
            />
          </Tooltip>

          <Input.Search
            placeholder="Search by product name, SKU, or brand…"
            defaultValue={currentQuery}
            key={currentQuery}
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
            size="large"
            style={{ flex: 1, maxWidth: 620 }}
            allowClear
          />

          <Space size={12} style={{ marginLeft: 'auto' }}>
            <Space size={8} align="center">
              <Text style={{ color: BRAND.silver, fontSize: 13 }}>{user?.name}</Text>
              {/* The tier decides every price on the page, so it is stated, not implied. */}
              <Tag
                style={{
                  marginInlineEnd: 0,
                  background: 'rgba(232, 163, 61, 0.16)',
                  border: `1px solid ${BRAND.amberDeep}`,
                  color: BRAND.amber,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}
              >
                {user?.tierName?.toUpperCase()}
              </Tag>
            </Space>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              style={{ color: BRAND.silverDim }}
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </Space>
        </Header>

        <Content>
          <Outlet />
        </Content>

        <Footer
          style={{
            background: BRAND.ink,
            borderTop: `1px solid ${BRAND.inkLine}`,
            color: BRAND.silverDim,
            textAlign: 'center',
            fontSize: 12,
            padding: '18px 24px',
          }}
        >
          Woltaphor · Wholesale prices shown are your {user?.tierName} tier rates and are confidential.
        </Footer>
      </AntLayout>
    </DealerTheme>
  );
}
