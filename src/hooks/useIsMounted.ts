import { useEffect, useRef } from 'react';

/**
 * Whether the component is still on screen.
 *
 * For loaders that are called from several places — on mount, and again after a create or
 * a delete — where the request-scoped flag the shared hooks use does not fit. Setting
 * state after an unmount is invisible in a browser but leaves React flushing work into a
 * component that no longer exists, which surfaces as an uncaught error the moment the
 * environment underneath it is torn down.
 *
 * Set inside the effect rather than at declaration, so it survives StrictMode's
 * mount-unmount-mount: the second mount puts it back to true.
 */
export function useIsMounted() {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return mounted;
}
