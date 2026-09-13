import { useEffect, useState } from 'react';

/**
 * Two breakpoints, because a phone and a tablet need different things.
 *
 * PHONE is where the header has to give up the wordmark and spell nothing out. TOUCH is
 * wider and covers tablets too: there is room for a full header, but not for a fixed
 * sidebar taking 300px of a 768px screen away from the results.
 */
export const PHONE = '(max-width: 767px)';
export const TOUCH = '(max-width: 1023px)';

/**
 * Whether the viewport matches the given breakpoint. Read during the first render rather
 * than from an effect, so a phone never paints the desktop layout and then jumps.
 */
const matches = (query: string) =>
  typeof window !== 'undefined' && window.matchMedia?.(query).matches === true;

export function useIsNarrow(query: string = PHONE): boolean {
  const [narrow, setNarrow] = useState(() => matches(query));

  // Re-read during render when the breakpoint itself changes, rather than from the effect
  // where it would paint the old answer once first.
  const [askedFor, setAskedFor] = useState(query);
  if (askedFor !== query) {
    setAskedFor(query);
    setNarrow(matches(query));
  }

  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return narrow;
}
