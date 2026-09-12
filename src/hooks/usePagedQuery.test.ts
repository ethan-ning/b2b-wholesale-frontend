import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePagedQuery } from './usePagedQuery';
import type { PagedResult } from '../api/types';

const page = <T,>(content: T[], total = content.length): PagedResult<T> =>
  ({ content, totalElements: total, totalPages: 1, page: 0, size: 10 }) as PagedResult<T>;

describe('usePagedQuery', () => {
  it('fetches once for the initial filters', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(['a']));
    const { result } = renderHook(() => usePagedQuery(fetcher, { q: 'hub' }));

    await waitFor(() => expect(result.current.data?.content).toEqual(['a']));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({ q: 'hub' }, 0);
  });

  /**
   * The reason the reset happens during render rather than in an effect: from an effect,
   * page 3 of the old filters is requested first and the reset fires a second request
   * behind it — two round trips, and briefly the wrong results.
   */
  it('returns to the first page when a filter changes, without an extra request', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(['a']));
    const { result, rerender } = renderHook(({ f }) => usePagedQuery(fetcher, f), {
      initialProps: { f: { q: 'hub' } },
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    fetcher.mockClear();

    rerender({ f: { q: 'mud' } });

    await waitFor(() => expect(result.current.page).toBe(0));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledWith({ q: 'mud' }, 0);
  });

  /** Callers build the filters object inline, so a fresh identity must not refetch. */
  it('compares filters by value, not by identity', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(['a']));
    const { rerender } = renderHook(({ f }) => usePagedQuery(fetcher, f), {
      initialProps: { f: { q: 'hub' } },
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    rerender({ f: { q: 'hub' } });

    await new Promise((r) => setTimeout(r, 30));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches the current page on reload', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(['a']));
    const { result } = renderHook(() => usePagedQuery(fetcher, { q: 'hub' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    act(() => result.current.reload());

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(result.current.page).toBe(0);
  });

  /**
   * Change filters quickly and the first response can land after the second. Without the
   * guard the slower, older result wins and the screen contradicts the filters.
   */
  it('drops a response whose filters are no longer current', async () => {
    let resolveFirst: (v: PagedResult<string>) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<PagedResult<string>>((r) => { resolveFirst = r; }))
      .mockResolvedValue(page(['new']));

    const { result, rerender } = renderHook(({ f }) => usePagedQuery(fetcher, f), {
      initialProps: { f: { q: 'slow' } },
    });

    rerender({ f: { q: 'fast' } });
    await waitFor(() => expect(result.current.data?.content).toEqual(['new']));

    act(() => resolveFirst(page(['stale'])));

    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.data?.content).toEqual(['new']);
  });

  /**
   * The first fetch has to announce itself. The guard that sets loading compares the
   * current request against the last one, and on the first render they are the same, so
   * nothing was announced — every list opened on an empty table and then filled in.
   */
  it('is loading before its first result arrives', async () => {
    const { result } = renderHook(() =>
      usePagedQuery(async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { content: ['a'], totalElements: 1, totalPages: 1, page: 0, size: 10 };
      }, {}),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.content).toEqual(['a']);
  });
});
