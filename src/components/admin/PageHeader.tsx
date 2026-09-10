import { Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const { Title } = Typography;

interface Props {
  title: ReactNode;
  /** A short line under the title, for what the screen is for or where its data comes from. */
  subtitle?: ReactNode;
  /** Shown to the left of the title on a detail screen. */
  backTo?: string;
  backLabel?: string;
  /** Buttons and filters, right-aligned on the same line as the title. */
  actions?: ReactNode;
}

/**
 * The top of every admin screen.
 *
 * Each page used to build its own, and they drifted — some titles sat on the flex row and
 * some above it, so the filters on one page were a few pixels off the ones on the next.
 */
export default function PageHeader({ title, subtitle, backTo, backLabel, actions }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <Space size={12}>
          {backTo && (
            <Link to={backTo}>
              <Button icon={<ArrowLeftOutlined />}>{backLabel ?? 'Back'}</Button>
            </Link>
          )}
          <Title level={4} style={{ margin: 0 }}>{title}</Title>
        </Space>
        {actions && <Space wrap>{actions}</Space>}
      </div>
      {subtitle && (
        <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
          {subtitle}
        </Typography.Text>
      )}
    </div>
  );
}
