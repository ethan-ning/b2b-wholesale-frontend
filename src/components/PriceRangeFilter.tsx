import { useState } from 'react';
import { Button, Space, Typography } from 'antd';
import MoneyInput from './MoneyInput';

const { Text } = Typography;

interface Props {
  priceMin: number | undefined;
  priceMax: number | undefined;
  onApply: (min: number | undefined, max: number | undefined) => void;
}

/**
 * Two boxes and an Apply, on the results toolbar beside sort — both narrow the same list,
 * and the sidebar's height belongs to the category tree. Enter applies.
 */
export default function PriceRangeFilter({ priceMin, priceMax, onApply }: Props) {
  // Draft values — the filter only applies on Apply, so the boxes are local state.
  const [min, setMin] = useState<number | undefined>(priceMin);
  const [max, setMax] = useState<number | undefined>(priceMax);

  // When the filter is cleared from outside, the draft must follow or the boxes keep
  // showing a range that is no longer applied.
  const [applied, setApplied] = useState<[number | undefined, number | undefined]>([priceMin, priceMax]);
  if (applied[0] !== priceMin || applied[1] !== priceMax) {
    setApplied([priceMin, priceMax]);
    setMin(priceMin);
    setMax(priceMax);
  }

  const isApplied = priceMin !== undefined || priceMax !== undefined;
  const isDirty = min !== priceMin || max !== priceMax;

  function handleApply() {
    onApply(min, max);
  }

  function handleClear() {
    setMin(undefined);
    setMax(undefined);
    onApply(undefined, undefined);
  }

  return (
    <Space size={6} align="center" wrap={false}>
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        Price
      </Text>
      {/* MoneyInput, not a bare InputNumber: a price box must refuse a letter as it is
          typed rather than swallow it and quietly correct itself on blur. */}
      <MoneyInput
        placeholder="Min"
        size="small"
        value={min}
        style={{ width: 92 }}
        onChange={(v) => setMin(v ?? undefined)}
        onPressEnter={handleApply}
      />
      <Text type="secondary">–</Text>
      <MoneyInput
        placeholder="Max"
        size="small"
        value={max}
        style={{ width: 92 }}
        onChange={(v) => setMax(v ?? undefined)}
        onPressEnter={handleApply}
      />
      {/* Apply only offers itself once the boxes differ from what is showing, so the
          toolbar is not permanently occupied by a button with nothing to do. */}
      <Button size="small" type="primary" onClick={handleApply} disabled={!isDirty}>
        Apply
      </Button>
      {isApplied && (
        <Button size="small" type="text" onClick={handleClear}>
          Clear
        </Button>
      )}
    </Space>
  );
}
