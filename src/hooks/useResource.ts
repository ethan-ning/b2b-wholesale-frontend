import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../api/http';

/**
 * One record, fetched once — the load-once sibling of [usePagedQuery].
 *
 * A superseded response is dropped, so navigating between two products cannot leave the
 * first one's data on the second's page, and a failure always ends the loading state
 * rather than leaving a spinner turning.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    load()
      .then((result) => { if (current) setData(result); })
      .catch((e: unknown) => { if (current) setError(apiErrorMessage(e, 'Could not load this page.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
    // `load` is intentionally not a dependency: callers define it inline, so depending on
    // its identity would refetch on every render. `deps` says when to ask again.
  }, [...deps, reloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    /** Ask again — after a create or a delete has changed what the answer would be. */
    reload: () => setReloadToken((n) => n + 1),
  };
}
