import { useEffect, useRef } from 'react';

/**
 * Whether the component is still on screen — for loaders called from several places,
 * where the request-scoped flag the shared hooks use does not fit.
 *
 * Set inside the effect rather than at declaration, so it survives StrictMode's
 * mount-unmount-mount.
 */
export function useIsMounted() {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return mounted;
}
