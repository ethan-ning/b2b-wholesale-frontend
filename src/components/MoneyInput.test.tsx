import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import MoneyInput from './MoneyInput';

/**
 * Driven through userEvent rather than fireEvent: it types character by character through
 * the real key sequence, which is the only way a keydown guard is exercised at all.
 */
function Harness({ initial }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <MoneyInput
      placeholder="Amount"
      value={value}
      onChange={(v) => setValue(v ?? undefined)}
    />
  );
}

const box = () => screen.getByPlaceholderText('Amount') as HTMLInputElement;

describe('MoneyInput', () => {
  it('keeps digits and a decimal point', async () => {
    render(<Harness />);
    await userEvent.type(box(), '12.50');

    expect(box().value).toBe('12.50');
  });

  it('refuses letters as they are typed, keeping the digits around them', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'abc12xy.5z0');

    expect(box().value).toBe('12.50');
  });

  it('refuses the characters that are legal in a number literal but not in a price', async () => {
    render(<Harness />);
    await userEvent.type(box(), '1e5');
    expect(box().value).toBe('15');

    await userEvent.clear(box());
    await userEvent.type(box(), '-20');
    expect(box().value).toBe('20');
  });

  it('can still be corrected with backspace', async () => {
    render(<Harness />);
    await userEvent.type(box(), '199');
    await userEvent.type(box(), '{backspace}{backspace}');

    expect(box().value).toBe('1');
  });

  it('shows the value it is given', () => {
    render(<Harness initial={42.5} />);

    expect(box().value).toBe('42.5');
  });

  it('refuses a pasted value that is not a number', async () => {
    render(<Harness />);
    box().focus();
    await userEvent.paste('99 dollars');

    expect(box().value).toBe('');
  });

  it('accepts a pasted number', async () => {
    render(<Harness />);
    box().focus();
    await userEvent.paste('34.99');

    expect(box().value).toBe('34.99');
  });
});
