import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import LoginPage from './LoginPage';
import { server } from '../test/server';
import { renderPage, signOut } from '../test/render';
import { DEALER_MUST_CHANGE } from '../test/fixtures';
import { useAuthStore } from '../store/authStore';

async function submit(email: string, password: string) {
  await userEvent.type(screen.getByPlaceholderText('dealer@example.com'), email);
  await userEvent.type(screen.getByPlaceholderText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(signOut);

describe('LoginPage', () => {
  it('signs a dealer in and sends them to the catalogue', async () => {
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await submit('dealer1@example.com', 'dealer123');

    await waitFor(() => expect(useAuthStore.getState().token).toBe('dealer-token'));
    expect(useAuthStore.getState().user?.tierName).toBe('Gold');
    // The route changed, so the login page is gone.
    await waitFor(() => expect(screen.getByTestId('elsewhere')).toBeInTheDocument());
  });

  /**
   * A dealer on an admin-issued password holds a token that reaches only the
   * change-password endpoint, so sending them anywhere else is a dead end.
   */
  it('sends a dealer who must change their password to that page instead', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json(DEALER_MUST_CHANGE)));
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await submit('dealer1@example.com', 'dealer123');

    await waitFor(() => expect(useAuthStore.getState().user?.mustChangePassword).toBe(true));
  });

  it('blames the credentials when the API says 401', async () => {
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await submit('dealer1@example.com', 'wrong-password');

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  /**
   * The three failures that used to be indistinguishable. Each cost real time precisely
   * because the page said "invalid password" and meant something else.
   */
  it('calls a 403 a configuration problem rather than a wrong password', async () => {
    server.use(http.post('/api/auth/login', () => new HttpResponse(null, { status: 403 })));
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await submit('dealer1@example.com', 'dealer123');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/configuration/i);
    expect(alert).not.toHaveTextContent(/invalid email or password/i);
  });

  it('says the server is not responding when the gateway answers for it', async () => {
    server.use(http.post('/api/auth/login', () => new HttpResponse(null, { status: 502 })));
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await submit('dealer1@example.com', 'dealer123');

    expect(await screen.findByRole('alert')).toHaveTextContent(/not responding/i);
  });

  it('says it could not reach the server when nothing answers at all', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.error()));
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await submit('dealer1@example.com', 'dealer123');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach/i);
  });

  it('will not submit without an email', async () => {
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await userEvent.type(screen.getByPlaceholderText('Password'), 'dealer123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('shows the brand, because this is the first page a dealer sees', () => {
    renderPage(<LoginPage />, { route: '/login', path: '/login' });

    expect(screen.getByText('WOLTAPHOR')).toBeInTheDocument();
    expect(screen.getByAltText('Woltaphor')).toHaveAttribute('src', expect.stringContaining('/brand/'));
  });
});
