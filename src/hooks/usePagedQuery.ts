import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../api/http';
import type { PagedResult } from '../api/types';

/**
 * Filtered, paginated list state. `filters` is compared by value, so callers can pass a
 * fresh object each render.
 *
 * Three things worth keeping: the page resets during render rather than from an effect,
 * which would fire a request with the stale page first; a superseded response is dropped;
 * and a failure is reported, or a dead API looks exactly like a search that matched
 * nothing.
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
