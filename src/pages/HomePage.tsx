import { useNavigate, Link } from 'react-router-dom';
import { Input, Typography, Space, Button } from 'antd';
import { SearchOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { PHONE, useIsNarrow } from '../hooks/useIsNarrow';
import { BRAND, HERO } from '../brand';

const { Title, Text } = Typography;

/** A few doors into the catalogue, for a dealer who arrived without a term in mind. */
const SHORTCUTS = ['Hub caps', 'Exhaust stacks', 'Mud flaps', 'Light bars', 'Marker lights'];

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const phone = useIsNarrow(PHONE);

  function search(term: string) {
    const q = term.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 68px - 58px)', background: '#f6f7f9' }}>
      {/*
       * The search box is the whole job of this page, so it sits on the brand image
       * rather than on flat grey — a dealer lands here and should be typing within a
       * second, not reading.
       */}
      <section
        style={{
          background: `linear-gradient(rgba(13,14,13,0.86), rgba(13,14,13,0.92)), url(${HERO}) center/cover no-repeat`,
          padding: phone ? '36px 16px 40px' : '64px 24px 72px',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <Text style={{ color: BRAND.amber, letterSpacing: '0.16em', fontSize: 12, fontWeight: 600 }}>
            WHOLESALE CATALOGUE
          </Text>
          <Title level={phone ? 3 : 2} style={{ color: '#fff', margin: '10px 0 6px' }}>
            Welcome back, {user?.name}
          </Title>
          <Text style={{ color: BRAND.silverDim, fontSize: 14 }}>
            Every price you see is your {user?.tierName} tier rate.
          </Text>

          <Input.Search
            placeholder="Search by product name, SKU, or brand…"
            onSearch={search}
            size="large"
            enterButton={
              <span>
                <SearchOutlined /> Search
              </span>
            }
            style={{ marginTop: 28 }}
            allowClear
          />

          <Space size={[8, 8]} wrap style={{ marginTop: 20, justifyContent: 'center' }}>
            {SHORTCUTS.map((term) => (
              <Button
                key={term}
                size="small"
                onClick={() => search(term)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(203,213,225,0.28)',
                  color: BRAND.silver,
                }}
              >
                {term}
              </Button>
            ))}
          </Space>
        </div>
      </section>

      <div style={{ textAlign: 'center', padding: '28px 24px' }}>
        <Link to="/search">
          <Button type="primary" size="large">
            Browse the full catalogue <ArrowRightOutlined />
          </Button>
        </Link>
        <div style={{ marginTop: 10 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Filter by category and price once you are in.
          </Text>
        </div>
      </div>
    </div>
  );
}
