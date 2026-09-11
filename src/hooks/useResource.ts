import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../api/http';

/**
 * One thing, fetched once. The load-once sibling of [usePagedQuery], for screens that read
 * a record rather than a list.
 *
 * Two things it does that the hand-rolled versions did not:
 *
 * - A response is dropped if the deps have moved on since it was requested, so navigating
 *   quickly between two products cannot leave the first one's data on the second's page.
 * - A failure always ends the loading state. Written by hand this is easy to miss, and a
 *   `.then()` with no `.catch()` leaves a spinner turning forever on a dead request.
 *
 * Screens that load several things into several pieces of state keep doing that
 * themselves — threading them through here would be an awkward fit for no gain.
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
