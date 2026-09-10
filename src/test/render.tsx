import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAdminAuthStore } from '../store/adminAuthStore';
import { DEALER, PLAIN_ADMIN, SUPER_ADMIN } from './fixtures';

/**
 * Renders a page the way the app does: inside a router, with whatever route parameters
 * it reads from the URL.
 *
 * `route` sets the starting URL and `path` the pattern it is matched against — a detail
 * page needs both, or `useParams` comes back empty and the page fetches `undefined`.
 */
export function renderPage(
  ui: ReactElement,
  { route = '/', path }: { route?: string; path?: string } = {},
) {
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      {path ? (
        <Routes>
          <Route path={path} element={ui} />
          {/* Somewhere for a redirect to land, so navigating away is observable. */}
          <Route path="*" element={<div data-testid="elsewhere" />} />
        </Routes>
      ) : (
        ui
      )}
    </MemoryRouter>,
  );
  return view;
}

/** Puts a dealer in the store, for pages that read the signed-in user. */
export function signIn(user: ReactNode | undefined = undefined) {
  void user;
  useAuthStore.getState().login(DEALER.token, DEALER.user);
}

/** Empties the store between tests that would otherwise inherit a session. */
export function signOut() {
  useAuthStore.getState().logout();
}

/**
 * Puts an admin in the admin store. Which role matters: the roster hides its controls
 * from anyone who is not a super admin, so tests assert both.
 */
export function signInAdmin({ superAdmin = true }: { superAdmin?: boolean } = {}) {
  useAdminAuthStore.getState().adminLogin('admin-token', superAdmin ? SUPER_ADMIN : PLAIN_ADMIN);
}

export function signOutAdmin() {
  useAdminAuthStore.getState().adminLogout();
}
