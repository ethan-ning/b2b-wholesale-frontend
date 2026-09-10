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
 * A field that only ever holds money.
 *
 * A plain InputNumber accepts the keystrokes and sorts it out later: type "12abc" and it
 * sits there looking like a value until focus moves, then silently becomes something
 * else. For a price that is the wrong trade — the moment to refuse a letter is when it is
 * typed, not after the dealer has moved on and stopped looking.
 *
 * Two approaches did not work before this one, both worth naming:
 *
 * - InputNumber's own `parser` runs inside the pipeline that also drives what the box
 *   displays, so one that rewrites every keystroke fights the component and rejects the
 *   digits along with the letters.
 * - `onKeyDown` passed to InputNumber never reaches the input; antd does not forward it.
 *
 * So the guard sits on a wrapper and runs in the capture phase, which reaches the event
 * before the input does regardless of what antd forwards.
 *
 * `e`, `+` and `-` are blocked too: valid in a JavaScript number literal, meaningless in
 * a price.
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
