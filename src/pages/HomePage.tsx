import { useNavigate, Link } from 'react-router-dom';
import { Input, Typography, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  function handleSearch(value: string) {
    const term = value.trim();
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        padding: '0 24px',
        background: '#f0f2f5',
      }}
    >
      <Space direction="vertical" size={16} style={{ width: '100%', maxWidth: 600, textAlign: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          Welcome, {user?.name}!
        </Title>
        <Text type="secondary">
          Search our full product catalog. Prices shown are your {user?.tierName} tier wholesale rates.
        </Text>

        <Input.Search
          placeholder="Search by product name, SKU, or brand..."
          onSearch={handleSearch}
          size="large"
          enterButton={<><SearchOutlined /> Search</>}
          style={{ marginTop: 8 }}
        />

        <Text type="secondary" style={{ fontSize: 12 }}>
          Tip: try "jacket", "exhaust", or a SKU like "PL001-BLK" — or{' '}
          <Link to="/search">browse the full catalog</Link>
        </Text>
      </Space>
    </div>
  );
}
