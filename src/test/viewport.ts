/**
 * Pretends the viewport is a given width, by answering `matchMedia` against it — there is
 * no layout to measure in a test environment.
 *
 * Call it before rendering: the hook reads the match once, during its first render.
 */
export function setViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches =
      (max ? width <= Number(max[1]) : true) && (min ? width >= Number(min[1]) : true);
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

export const PHONE_WIDTH = 390;
export const TABLET_WIDTH = 820;
export const DESKTOP_WIDTH = 1440;
