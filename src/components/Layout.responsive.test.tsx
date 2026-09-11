import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Layout from './Layout';
import SearchPage from '../pages/SearchPage';
import { renderPage, signIn, signOut } from '../test/render';
import { DESKTOP_WIDTH, PHONE_WIDTH, TABLET_WIDTH, setViewportWidth } from '../test/viewport';

const originalMatchMedia = window.matchMedia;

beforeEach(signIn);
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  signOut();
});

describe('the dealer header on a phone', () => {
  it('drops the wordmark for the mark alone', () => {
    setViewportWidth(PHONE_WIDTH);
    renderPage(<Layout />, { route: '/search' });

    // The full lockup is nearly 2:1; at a height that leaves room for search, the letters
    // are unreadable anyway.
    expect(screen.getByAltText('Woltaphor')).toHaveAttribute('src', '/brand/logo-mark.png');
  });

  it('folds the name, tier and sign-out into one control', async () => {
    setViewportWidth(PHONE_WIDTH);
    renderPage(<Layout />, { route: '/search' });

    // Spelled out they are wider than the search box beside them.
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Gold Dealer')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /account/i }));

    // The tier is still reachable — it decides every price on the page.
    expect(await screen.findByText(/Gold Dealer · Gold tier/)).toBeInTheDocument();
    expect(screen.getByText(/sign out/i)).toBeInTheDocument();
  });

  it('shortens the search placeholder to something that fits', () => {
    setViewportWidth(PHONE_WIDTH);
    renderPage(<Layout />, { route: '/search' });

    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });
});

describe('the dealer header on a desktop', () => {
  it('shows the full lockup, the tier and a spelled-out sign-out', () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPage(<Layout />, { route: '/search' });

    expect(screen.getByAltText('Woltaphor')).toHaveAttribute('src', '/brand/logo-horizontal.png');
    expect(screen.getByText('Gold Dealer')).toBeInTheDocument();
    expect(screen.getByText('GOLD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});

describe('the header search box', () => {
  it('is absent on the landing page, where the hero already has one', () => {
    setViewportWidth(PHONE_WIDTH);
    renderPage(<Layout />, { route: '/' });

    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    // The logo and the account control stay.
    expect(screen.getByAltText('Woltaphor')).toBeInTheDocument();
  });

  it('is present everywhere else, because there is no other way to search', () => {
    setViewportWidth(PHONE_WIDTH);
    renderPage(<Layout />, { route: '/search' });

    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });
});

describe('the category filter by viewport', () => {
  /** A fixed 300px rail on a 768px screen is most of the results. */
  it('is a drawer on a tablet, opened from the toolbar', async () => {
    setViewportWidth(TABLET_WIDTH);
    renderPage(<SearchPage />, { route: '/search', path: '/search' });
    await waitFor(() => expect(screen.getByPlaceholderText('Min')).toBeInTheDocument());

    // Not on screen until asked for.
    expect(screen.queryByText('Wheels & Hubs')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /category/i }));

    expect(await screen.findByText('Wheels & Hubs')).toBeInTheDocument();
  });

  it('is a permanent rail on a desktop, with no button for it', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPage(<SearchPage />, { route: '/search', path: '/search' });

    expect(await screen.findByText('Wheels & Hubs')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^category$/i })).not.toBeInTheDocument();
  });

  it('closes itself once a category is chosen', async () => {
    setViewportWidth(PHONE_WIDTH);
    renderPage(<SearchPage />, { route: '/search', path: '/search' });
    await waitFor(() => expect(screen.getByPlaceholderText('Min')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(await screen.findByText('Wheels & Hubs'));

    // The next thing anyone wants is to see what it did.
    await waitFor(() => expect(screen.getByText(/Category: Wheels & Hubs/)).toBeInTheDocument());
  });
});
