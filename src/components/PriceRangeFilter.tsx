import { useState } from 'react';
import { InputNumber, Button, Space, Typography } from 'antd';

const { Text } = Typography;

interface Props {
  priceMin: number | undefined;
  priceMax: number | undefined;
  onApply: (min: number | undefined, max: number | undefined) => void;
}

export default function PriceRangeFilter({ priceMin, priceMax, onApply }: Props) {
  const [min, setMin] = useState<number | undefined>(priceMin);
  const [max, setMax] = useState<number | undefined>(priceMax);

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
      <Text type="secondary" style={{ fontSize: 12 }}>
        Price range (wholesale)
      </Text>
      <Space>
        <InputNumber
          placeholder="Min"
          value={min}
          min={0}
          prefix="$"
          style={{ width: 90 }}
          onChange={(v) => setMin(v ?? undefined)}
        />
        <Text>–</Text>
        <InputNumber
          placeholder="Max"
          value={max}
          min={0}
          prefix="$"
          style={{ width: 90 }}
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
