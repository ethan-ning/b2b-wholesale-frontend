import { dealerHandlers } from './dealerHandlers';

/**
 * Dealer routes only. The admin portal runs against the real backend: MSW starts with
 * `onUnhandledRequest: 'bypass'`, so `/api/admin/*` falls through to Vite's proxy.
 *
 * The admin mocks were deleted rather than kept in step. Two implementations of one
 * contract drift, and the backend is now the one that counts. The dealer portal stays
 * mocked until its login exists server-side.
 */
export const handlers = [...dealerHandlers];
