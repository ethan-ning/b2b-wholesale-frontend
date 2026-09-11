import { useLocation, useNavigate, Outlet, useSearchParams } from 'react-router-dom';
import { Layout as AntLayout, Input, Button, Space, Typography, Tag, Tooltip, Dropdown } from 'antd';
import { LogoutOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useIsNarrow } from '../hooks/useIsNarrow';
import { BRAND, LOGO_HORIZONTAL, LOGO_MARK } from '../brand';
import DealerTheme from './DealerTheme';

const { Header, Content, Footer } = AntLayout;
const { Text } = Typography;

export default function Layout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuthStore();
  const narrow = useIsNarrow();
  // The landing page is a search box on a hero image. A second one in the bar above it is
  // the same control twice, and on a phone it costs a fifth of the first screen.
  const onLanding = useLocation().pathname === '/';

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
            gap: narrow ? 10 : 20,
            padding: narrow ? '0 12px' : '0 24px',
            height: narrow ? 56 : 68,
            // The logo's own backdrop, so the artwork has no visible edge against the bar.
            background: BRAND.ink,
            borderBottom: `1px solid ${BRAND.inkLine}`,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {/*
           * On a phone the wordmark is dropped for the hexagon alone. The full lockup is
           * nearly 2:1, so at a height that leaves room for the search box the letters
           * are unreadable anyway — and search is what the header is for.
           */}
          <Tooltip title="Woltaphor home">
            <img
              src={narrow ? LOGO_MARK : LOGO_HORIZONTAL}
              alt="Woltaphor"
              onClick={() => navigate('/')}
              style={{
                height: narrow ? 32 : 44,
                cursor: 'pointer',
                display: 'block',
                flexShrink: 0,
                borderRadius: 4,
              }}
            />
          </Tooltip>

          {onLanding ? (
            <div style={{ flex: 1 }} />
          ) : (
            <Input.Search
              placeholder={narrow ? 'Search…' : 'Search by product name, SKU, or brand…'}
              defaultValue={currentQuery}
              key={currentQuery}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
              size={narrow ? 'middle' : 'large'}
              style={{ flex: 1, maxWidth: narrow ? undefined : 620, minWidth: 0 }}
              allowClear
            />
          )}

          {narrow ? (
            /*
             * Name, tier and sign-out fold into one control. Spelled out they take more
             * width than the search box they would be sitting next to, and the tier still
             * has to be reachable — it decides every price on the page.
             */
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'who', label: `${user?.name} · ${user?.tierName} tier`, disabled: true },
                  { type: 'divider' },
                  { key: 'out', icon: <LogoutOutlined />, label: 'Sign out', onClick: handleLogout },
                ],
              }}
            >
              <Button
                type="text"
                aria-label="Account"
                icon={<UserOutlined />}
                style={{ color: BRAND.silver, flexShrink: 0 }}
              />
            </Dropdown>
          ) : (
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
          )}
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
            padding: narrow ? '14px 16px' : '18px 24px',
          }}
        >
          Woltaphor · Wholesale prices shown are your {user?.tierName} tier rates and are confidential.
        </Footer>
      </AntLayout>
    </DealerTheme>
  );
}
