/**
 * Pretends the viewport is a given width.
 *
 * jsdom has no layout, so `matchMedia` is the only thing the app can ask — which is why
 * the breakpoint hook uses it rather than reading a width. This stands in for it, parsing
 * the `max-width` out of each query and answering against the width given.
 *
 * Call it before rendering: the hook reads the match once during its first render, so a
 * change afterwards would mean asserting on a layout the component never painted.
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
