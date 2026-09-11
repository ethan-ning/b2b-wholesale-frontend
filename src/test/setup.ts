import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { message, notification } from 'antd';
import { resetAdminState } from './adminHandlers';
import { server } from './server';

// axios needs an absolute base; the app's relative '/api' has no origin to resolve
// against outside a browser.
globalThis.location ??= new URL('http://localhost') as unknown as Location;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetAdminState();
  cleanup();
  // antd renders toasts into a portal cleanup() does not own, and one left over is a
  // stray role="alert" in the next test. destroy() rather than removing the container,
  // which antd holds a reference to — and the notices by hand, since destroy() only fades.
  message.destroy();
  notification.destroy();
  document.querySelectorAll('.ant-message-notice, .ant-notification-notice').forEach((n) => n.remove());
  localStorage.clear();
});
afterAll(() => server.close());

/**
 * Neither is implemented by the DOM stand-in, and antd asks for both on mount — Select
 * and Tree for responsive sizing, Table for its own layout. Without them every component
 * test fails on an unrelated TypeError before it reaches its assertion.
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
