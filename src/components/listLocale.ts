import type { ReactNode } from 'react';

/**
 * What a table shows when it has no rows.
 *
 * Nothing, while a fetch is in flight. antd draws its spinner over the body, but "No
 * data" underneath still reads as an answer rather than a wait — which is exactly how
 * every list looked for the moment before it filled in.
 */
export function listLocale(loading: boolean, empty: ReactNode) {
  return { emptyText: loading ? ' ' : empty };
}
