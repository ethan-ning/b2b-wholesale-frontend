import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDebounced } from './useDebounced';

describe('useDebounced', () => {
  it('holds the first value until the delay has passed', async () => {
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, 40), {
      initialProps: { v: 'h' },
    });

    expect(result.current).toBe('h');

    rerender({ v: 'hu' });
    rerender({ v: 'hub' });
    // Still the original: nothing has settled yet, so nothing downstream has been asked.
    expect(result.current).toBe('h');

    await waitFor(() => expect(result.current).toBe('hub'));
  });

  /** The point of it: what lands is the last value, not every value on the way there. */
  it('settles once on the final value, skipping the ones typed through', async () => {
    const seen: string[] = [];
    const { result, rerender } = renderHook(({ v }) => {
      const settled = useDebounced(v, 40);
      if (seen.at(-1) !== settled) seen.push(settled);
      return settled;
    }, { initialProps: { v: '' } });

    for (const v of ['h', 'hu', 'hub', 'hubc', 'hubca', 'hubcap']) rerender({ v });
    await waitFor(() => expect(result.current).toBe('hubcap'));

    expect(seen).toEqual(['', 'hubcap']);
  });
});
