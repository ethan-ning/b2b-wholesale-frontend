import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../api/http';
import type { PagedResult } from '../api/types';

/**
 * Filtered, paginated list state — the shape every list screen here needs.
 *
 * Two things it gets right that the hand-rolled versions did not:
 *
 * - Changing a filter resets to page 1 **during render**, not from an effect. From an
 *   effect, one request fires with the stale page before the reset triggers a second.
 * - A response is dropped if its filters or page are no longer current, so quickly
 *   changing filters cannot leave a slow earlier response on screen.
 * - A failure is reported. Without a catch the rejection went nowhere, the list kept
 *   whatever it had, and a dead API was indistinguishable from a search that matched
 *   nothing — the screen said "No data" either way.
 *
 * `filters` is compared by value, so callers can pass a fresh object each render.
 */
export function usePagedQuery<F, T>(
  fetcher: (filters: F, page: number) => Promise<PagedResult<T>>,
  filters: F,
) {
  const key = JSON.stringify(filters);
  const [page, setPage] = useState(0);
  const [appliedKey, setAppliedKey] = useState(key);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<PagedResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (key !== appliedKey) {
    setAppliedKey(key);
    setPage(0);
  }

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    fetcher(JSON.parse(key) as F, page)
      .then((result) => { if (current) { setData(result); } })
      .catch((e: unknown) => { if (current) setError(apiErrorMessage(e, 'Could not load these results.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
    // `fetcher` is intentionally not a dependency: callers define it inline, so
    // depending on its identity would refetch on every render.
  }, [key, page, reloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    page,
    setPage,
    /** Refetch the current page — after a delete or a status toggle. */
    reload: () => setReloadToken((n) => n + 1),
  };
}
