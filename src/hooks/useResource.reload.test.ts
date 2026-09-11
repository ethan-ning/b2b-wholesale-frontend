import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResource } from './useResource';

describe('useResource reload', () => {
  /**
   * SellfoxPage drives its polling with `setInterval(reload, …)` inside an effect keyed on
   * reload. A fresh closure each render would clear and restart that interval before it
   * ever fired, and the screen would never notice a run finishing.
   */
  it('keeps the same identity across renders', async () => {
    const load = vi.fn().mockResolvedValue({ id: 1 });
    const { result, rerender } = renderHook(() => useResource(load, []));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const first = result.current.reload;
    rerender();

    expect(result.current.reload).toBe(first);
  });

  it('still refetches when called', async () => {
    const load = vi.fn().mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useResource(load, []));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    result.current.reload();

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
