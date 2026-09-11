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

/** @deprecated Prefer PHONE — kept so an older import does not break. */
export const NARROW = PHONE;

/**
 * Whether the viewport matches the given breakpoint. Read during the first render rather
 * than from an effect, so a phone never paints the desktop layout and then jumps.
 */
export function useIsNarrow(query: string = PHONE): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true,
  );

  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    setNarrow(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return narrow;
}
