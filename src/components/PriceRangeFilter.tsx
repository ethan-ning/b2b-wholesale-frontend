import { useState } from 'react';
import { Button, Space, Typography } from 'antd';
import MoneyInput from './MoneyInput';

const { Text } = Typography;

interface Props {
  priceMin: number | undefined;
  priceMax: number | undefined;
  onApply: (min: number | undefined, max: number | undefined) => void;
}

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

  function handleApply() {
    onApply(min, max);
  }

  function handleClear() {
    setMin(undefined);
    setMax(undefined);
    onApply(undefined, undefined);
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {/* MoneyInput, not a bare InputNumber: a price box must refuse a letter as it is
          typed rather than swallow it and quietly correct itself on blur. */}
      <Space size={8} align="center">
        <MoneyInput
          placeholder="Min"
          value={min}
          style={{ width: 108 }}
          onChange={(v) => setMin(v ?? undefined)}
        />
        <Text type="secondary">–</Text>
        <MoneyInput
          placeholder="Max"
          value={max}
          style={{ width: 108 }}
          onChange={(v) => setMax(v ?? undefined)}
        />
      </Space>
      <Space>
        <Button size="small" type="primary" onClick={handleApply}>
          Apply
        </Button>
        <Button size="small" onClick={handleClear}>
          Clear
        </Button>
      </Space>
    </Space>
  );
}
