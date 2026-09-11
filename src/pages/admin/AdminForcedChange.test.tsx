import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import AdminProtectedRoute from '../../components/admin/AdminProtectedRoute';
import AdminChangePasswordPage from './AdminChangePasswordPage';
import AdminLoginPage from './AdminLoginPage';
import { server } from '../../test/server';
import { signInAdmin, signOutAdmin } from '../../test/render';
import { SUPER_ADMIN } from '../../test/fixtures';
import { useAdminAuthStore } from '../../store/adminAuthStore';

/** The back office behind the guard, so "was it reached" is observable. */
function renderGuarded(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/admin" element={<AdminProtectedRoute />}>
          <Route path="change-password" element={<AdminChangePasswordPage />} />
          <Route index element={<div>Dashboard</div>} />
          <Route path="admins" element={<div>Roster</div>} />
        </Route>
        <Route path="/admin/login" element={<div>Sign in</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const forced = () =>
  useAdminAuthStore.getState().adminLogin('restricted-token', { ...SUPER_ADMIN, mustChangePassword: true });

beforeEach(signOutAdmin);

describe('an admin still on a generated password', () => {
  it('is sent to the change screen instead of the dashboard', async () => {
    forced();
    renderGuarded('/admin');

    expect(await screen.findByText(/choose a password/i)).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  /** Every route, not only the landing one — the sidebar leads nowhere until it is done. */
  it('cannot reach any other admin route either', async () => {
    forced();
    renderGuarded('/admin/admins');

    expect(await screen.findByText(/choose a password/i)).toBeInTheDocument();
    expect(screen.queryByText('Roster')).not.toBeInTheDocument();
  });

  it('reaches the back office once the password is changed', async () => {
    forced();
    renderGuarded('/admin');
    await screen.findByText(/choose a password/i);

    await userEvent.type(screen.getByLabelText('Temporary password'), 'admin123');
    await userEvent.type(screen.getByLabelText('New password'), 'ChosenPw12345');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'ChosenPw12345');
    await userEvent.click(screen.getByRole('button', { name: /set password and continue/i }));

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    // The restricted token is swapped for the session the change handed back, or the
    // screen would be open while every request behind it was refused.
    expect(useAdminAuthStore.getState().token).toBe('settled-token');
    expect(useAdminAuthStore.getState().admin?.mustChangePassword).toBe(false);
  });

  it('says so when the temporary password is wrong, and stays put', async () => {
    forced();
    renderGuarded('/admin');
    await screen.findByText(/choose a password/i);

    await userEvent.type(screen.getByLabelText('Temporary password'), 'not-the-one');
    await userEvent.type(screen.getByLabelText('New password'), 'ChosenPw12345');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'ChosenPw12345');
    await userEvent.click(screen.getByRole('button', { name: /set password and continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/current password is incorrect/i);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('catches a mistyped confirmation before asking the server', async () => {
    forced();
    renderGuarded('/admin');
    await screen.findByText(/choose a password/i);

    await userEvent.type(screen.getByLabelText('Temporary password'), 'admin123');
    await userEvent.type(screen.getByLabelText('New password'), 'ChosenPw12345');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'ChosenPw12344');
    await userEvent.click(screen.getByRole('button', { name: /set password and continue/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
  });
});

describe('an admin whose password is their own', () => {
  it('goes straight through', async () => {
    signInAdmin();
    renderGuarded('/admin');

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});

describe('signing in', () => {
  it('lands on the change screen when the account is still on a generated password', async () => {
    server.use(http.post('/api/admin/auth/login', () =>
      HttpResponse.json({ token: 'restricted', admin: { ...SUPER_ADMIN, mustChangePassword: true } })));

    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/change-password" element={<div>Choose a password screen</div>} />
          <Route path="/admin" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText('admin@example.com'), 'owner@example.com');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Choose a password screen')).toBeInTheDocument());
  });
});
