import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResource } from './useResource';

describe('useResource', () => {
  it('loads once and reports the result', async () => {
    const load = vi.fn().mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useResource(load, ['a']));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ id: 1 });
    expect(result.current.error).toBeNull();
  });

  /** A `.then()` with no `.catch()` leaves a spinner turning forever on a dead request. */
  it('ends the loading state on failure, and says what went wrong', async () => {
    const load = vi.fn().mockRejectedValue({ response: { data: { message: 'No such product' } } });
    const { result } = renderHook(() => useResource(load, ['a']));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('No such product');
    expect(result.current.data).toBeNull();
  });

  it('reloads when its dependencies change', async () => {
    const load = vi.fn().mockResolvedValue({ id: 1 });
    const { rerender } = renderHook(({ dep }) => useResource(load, [dep]), {
      initialProps: { dep: 'a' },
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    rerender({ dep: 'b' });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  /**
   * Navigating quickly between two products must not leave the first one's data on the
   * second one's page.
   */
  it('ignores a response whose dependencies have moved on', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const load = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValue({ id: 'second' });

    const { result, rerender } = renderHook(({ dep }) => useResource(load, [dep]), {
      initialProps: { dep: 'first' },
    });
    rerender({ dep: 'second' });
    await waitFor(() => expect(result.current.data).toEqual({ id: 'second' }));

    resolveFirst({ id: 'first' });

    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.data).toEqual({ id: 'second' });
  });
});
