import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { message, notification } from 'antd';
import { resetAdminState } from './adminHandlers';
import { server } from './server';

// axios needs an absolute base in jsdom; the app's relative '/api' has no origin to
// resolve against outside a browser.
globalThis.location ??= new URL('http://localhost') as unknown as Location;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetAdminState();
  cleanup();
  // antd renders toasts into a portal on document.body, which cleanup() does not own. A
  // "Removed …" toast from one test was still on screen during the next, where it was
  // the first thing matching role="alert".
  //
  // destroy() rather than removing the container: antd holds a reference to it, so
  // tearing that out sends every later toast into a node nobody can see. destroy() only
  // starts a fade, though, so the notices themselves are dropped here — a toast still
  // animating out is a second role="alert" in whichever test runs next.
  message.destroy();
  notification.destroy();
  document.querySelectorAll('.ant-message-notice, .ant-notification-notice').forEach((n) => n.remove());
  localStorage.clear();
});
afterAll(() => server.close());

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
