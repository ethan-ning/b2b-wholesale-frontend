import { Badge } from 'antd';

export function StockBadge({ qty }: { qty: number }) {
  if (qty >= 10) return <Badge color="green" text={qty} />;
  if (qty > 0) return <Badge color="orange" text={qty} />;
  return <Badge color="red" text="0" />;
}
