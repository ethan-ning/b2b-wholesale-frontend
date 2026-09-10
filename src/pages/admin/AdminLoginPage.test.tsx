import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import AdminLoginPage from './AdminLoginPage';
import { server } from '../../test/server';
import { renderPage, signOutAdmin } from '../../test/render';
import { useAdminAuthStore } from '../../store/adminAuthStore';

async function submit(password: string) {
  await userEvent.type(screen.getByPlaceholderText('admin@example.com'), 'owner@example.com');
  await userEvent.type(screen.getByPlaceholderText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

const open = () => renderPage(<AdminLoginPage />, { route: '/admin/login', path: '/admin/login' });

beforeEach(signOutAdmin);

describe('AdminLoginPage', () => {
  it('signs an admin in and keeps their role', async () => {
    open();

    await submit('admin123');

    await waitFor(() => expect(useAdminAuthStore.getState().token).toBe('admin-token'));
    expect(useAdminAuthStore.getState().admin?.role).toBe('SUPER_ADMIN');
  });

  it('blames the credentials on a 401', async () => {
    open();

    await submit('wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
    expect(useAdminAuthStore.getState().token).toBeNull();
  });

  /**
   * The bug that cost an afternoon: CORS refused the request before the password was ever
   * checked, and the page reported it as a wrong password. The two must never read alike.
   */
  it('calls a 403 a configuration problem, not a wrong password', async () => {
    server.use(http.post('/api/admin/auth/login', () => new HttpResponse(null, { status: 403 })));
    open();

    await submit('admin123');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/configuration/i);
    expect(alert).not.toHaveTextContent(/invalid email or password/i);
  });

  it('says the server is not responding when nothing is behind the proxy', async () => {
    server.use(http.post('/api/admin/auth/login', () => new HttpResponse(null, { status: 502 })));
    open();

    await submit('admin123');

    expect(await screen.findByRole('alert')).toHaveTextContent(/not responding/i);
  });

  /**
   * Two separate account systems. An admin credential on the dealer page — and the
   * reverse — must not half-work.
   */
  it('posts to the admin endpoint, not the dealer one', async () => {
    const seen: string[] = [];
    server.use(
      http.post('/api/admin/auth/login', async ({ request }) => {
        seen.push(new URL(request.url).pathname);
        return HttpResponse.json({ token: 'admin-token', admin: { id: 1, email: 'x', name: 'x', role: 'ADMIN' } });
      }),
    );
    open();

    await submit('admin123');

    await waitFor(() => expect(seen).toEqual(['/api/admin/auth/login']));
  });

  it('will not submit an empty form', async () => {
    open();

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(useAdminAuthStore.getState().token).toBeNull();
  });
});
