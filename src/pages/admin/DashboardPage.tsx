import { Row, Col, Card, Statistic, Typography, Tag } from 'antd';
import {
  ShoppingOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  WarningOutlined,
  StopOutlined,
} from '@ant-design/icons';
import * as api from '../../api/adminApi';
import { useResource } from '../../hooks/useResource';
import { PageError, PageLoading } from '../../components/PageState';

const { Title } = Typography;

export default function DashboardPage() {
  const { data: stats, loading, error } = useResource(() => api.fetchDashboard(), []);

  if (loading) return <PageLoading />;
  if (error || !stats) return <PageError message={error ?? 'Could not load the dashboard.'} />;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Products"
              value={stats.totalProducts}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Active Products"
              value={stats.activeProducts}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              suffix={
                <Tag color="success" style={{ marginLeft: 8 }}>
                  {stats.totalProducts > 0
                    ? Math.round((stats.activeProducts / stats.totalProducts) * 100)
                    : 0}%
                </Tag>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Registered Dealers"
              value={stats.totalCustomers}
              prefix={<TeamOutlined />}
              suffix={
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {stats.activeCustomers} active
                </Tag>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Low Stock Alerts"
              value={stats.lowStockAlerts}
              prefix={<WarningOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: stats.lowStockAlerts > 0 ? '#fa8c16' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Out of Stock SKUs"
              value={stats.outOfStockCount}
              prefix={<StopOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: stats.outOfStockCount > 0 ? '#ff4d4f' : undefined }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
