import '@testing-library/jest-dom/vitest';

/**
 * jsdom implements neither of these, and antd asks for both on mount — Select and Tree
 * for responsive sizing, Table for its own layout. Without them every component test
 * fails on an unrelated TypeError before it reaches its assertion.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
