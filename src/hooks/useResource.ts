import { useCallback, useEffect, useState } from 'react';
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

  /*
   * The reset happens during render rather than at the top of the effect. From the effect
   * it is a second render immediately after the first, and for one frame the screen shows
   * the previous record as though it were the new one.
   */
  const key = JSON.stringify([deps, reloadToken]);
  const [loadedKey, setLoadedKey] = useState(key);
  if (key !== loadedKey) {
    setLoadedKey(key);
    setLoading(true);
    setError(null);
  }

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let current = true;
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
    /**
     * Ask again — after a create or a delete has changed what the answer would be.
     * Stable, because callers put it in an effect's dependencies.
     */
    reload,
  };
}
