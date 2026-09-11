import { InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';
import type { ClipboardEvent, CSSProperties, KeyboardEvent } from 'react';

type Props = Omit<InputNumberProps<number>, 'parser' | 'formatter' | 'stringMode'> & {
  /** Shown inside the field. Defaults to a dollar sign. */
  currency?: string;
};

/** Editing keys that must keep working — without these the field cannot be corrected. */
const ALLOWED_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
]);

/**
 * A field that only ever holds money. `e`, `+` and `-` are refused along with letters:
 * legal in a number literal, meaningless in a price.
 *
 * The guard sits on a wrapper in the capture phase because neither alternative works —
 * InputNumber's `parser` runs inside the pipeline that drives the display and ends up
 * rejecting the digits too, and antd does not forward `onKeyDown` to the input.
 */
export default function MoneyInput({ currency = '$', style, ...props }: Props) {
  function onKeyDownCapture(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.ctrlKey || event.metaKey || ALLOWED_KEYS.has(event.key)) return;
    // Single characters only; anything longer is a named key already handled above.
    if (event.key.length === 1 && !/[\d.]/.test(event.key)) event.preventDefault();
  }

  function onPasteCapture(event: ClipboardEvent<HTMLSpanElement>) {
    const text = event.clipboardData.getData('text');
    if (!/^\s*\d*\.?\d*\s*$/.test(text)) event.preventDefault();
  }

  return (
    <span
      onKeyDownCapture={onKeyDownCapture}
      onPasteCapture={onPasteCapture}
      style={{ display: 'inline-block', ...(style as CSSProperties) }}
    >
      <InputNumber<number>
        min={0}
        inputMode="decimal"
        prefix={currency}
        controls={false}
        style={{ width: '100%' }}
        {...props}
      />
    </span>
  );
}
