import { Row, Col, Card, Statistic, Tag } from 'antd';
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
import PageHeader from '../../components/admin/PageHeader';

export default function DashboardPage() {
  const { data: stats, loading, error } = useResource(() => api.fetchDashboard(), []);

  if (loading) return <PageLoading />;
  if (error || !stats) return <PageError message={error ?? 'Could not load the dashboard.'} />;

  const visibleShare = stats.totalProducts > 0
    ? Math.round((stats.activeProducts / stats.totalProducts) * 100)
    : 0;

  // Amber and red only when there is something to act on. A zero painted red reads as a
  // problem, when it is the best possible answer to "how many SKUs are out of stock".
  const lowStockSpine = stats.lowStockAlerts > 0 ? 'section-card--attention' : '';
  const outOfStockSpine = stats.outOfStockCount > 0 ? 'section-card--danger' : '';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Catalog and stock as of the last Sellfox sync."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card section-card--pricing">
            <Statistic
              title="Total Products"
              value={stats.totalProducts}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card section-card--categories">
            <Statistic
              title="Visible to Dealers"
              value={stats.activeProducts}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
              valueStyle={{ color: '#16a34a' }}
              suffix={<Tag color="success" style={{ marginLeft: 8 }}>{visibleShare}%</Tag>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card section-card--people">
            <Statistic
              title="Registered Dealers"
              value={stats.totalCustomers}
              prefix={<TeamOutlined style={{ color: '#0891b2' }} />}
              suffix={
                <Tag color="cyan" style={{ marginLeft: 8 }}>{stats.activeCustomers} active</Tag>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className={`stat-card ${lowStockSpine}`}>
            <Statistic
              title="Low Stock Alerts"
              value={stats.lowStockAlerts}
              prefix={<WarningOutlined style={{ color: stats.lowStockAlerts > 0 ? '#f59e0b' : '#94a3b8' }} />}
              valueStyle={{ color: stats.lowStockAlerts > 0 ? '#f59e0b' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className={`stat-card ${outOfStockSpine}`}>
            <Statistic
              title="Out of Stock SKUs"
              value={stats.outOfStockCount}
              prefix={<StopOutlined style={{ color: stats.outOfStockCount > 0 ? '#dc2626' : '#94a3b8' }} />}
              valueStyle={{ color: stats.outOfStockCount > 0 ? '#dc2626' : undefined }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
