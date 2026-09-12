import { useEffect, useState } from 'react';

/**
 * A value that settles rather than changing on every keystroke.
 *
 * Typing into a box that filters on the server fires one request per character, and all
 * but the last are thrown away — six queries to answer one question. What the box shows
 * stays immediate; only what is asked of the API waits.
 *
 * For typed text only. A checkbox or a page change is one deliberate act and should be
 * answered at once.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
