import { useCallback, useEffect, useState } from 'react';
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
  // True from the start: mounting always fetches, and the guard below cannot announce it
  // because on the first render there is nothing yet to differ from. Left false, every
  // list opened on an empty table with no sign anything was coming, then filled in.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (key !== appliedKey) {
    setAppliedKey(key);
    setPage(0);
  }

  // Same reasoning as the page reset above: done here it is one render, and the list never
  // shows the previous filter's results as though they answered the new one.
  const request = `${key}|${page}|${reloadToken}`;
  const [requested, setRequested] = useState(request);
  if (request !== requested) {
    setRequested(request);
    setLoading(true);
    setError(null);
  }

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let current = true;
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
    /** Refetch the current page — after a delete or a status toggle. Stable. */
    reload,
  };
}
