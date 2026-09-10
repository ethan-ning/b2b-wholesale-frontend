import { Alert, Spin } from 'antd';

/**
 * What a screen shows instead of itself, while it waits or after it fails.
 *
 * Both were copy-pasted into five pages, which is how the error alerts drifted — some
 * carried an icon and some did not, so the same failure looked like two different kinds
 * of problem depending on where you hit it.
 */
export function PageLoading() {
  return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return <Alert type="error" message={message} showIcon />;
}
