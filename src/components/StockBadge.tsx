import { Badge } from 'antd';

/**
 * How much of a SKU is on hand, coloured by how worried to be about it.
 *
 * The API decides what "low" means — the threshold lives in the domain, and a copy of it
 * here would be a second definition of the same idea. They drifted once already: this
 * component used to call anything under ten low while the server used five, so a SKU with
 * seven showed an amber badge beside a green "OK" tag in the same row.
 */
export function StockBadge({ qty, low }: { qty: number; low: boolean }) {
  if (qty === 0) return <Badge color="red" text="0" />;
  return <Badge color={low ? 'orange' : 'green'} text={qty} />;
}
