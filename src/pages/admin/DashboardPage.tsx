import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin, Alert, Typography, Tag } from 'antd';
import {
  ShoppingOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  WarningOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { DashboardStats } from '../../api/types';
import * as api from '../../api/adminApi';

const { Title } = Typography;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchDashboard()
      .then(setStats)
      .catch(() => setError('Failed to load dashboard stats.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error || !stats) return <Alert type="error" message={error ?? 'Error'} />;

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
