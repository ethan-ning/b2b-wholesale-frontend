import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import AdminUsersPage from './AdminUsersPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

const row = (email: string) => screen.getByText(email).closest('tr') as HTMLElement;

beforeEach(signOutAdmin);

describe('AdminUsersPage', () => {
  it('lists who holds the keys, with their roles', async () => {
    signInAdmin();
    renderPage(<AdminUsersPage />);

    expect(await screen.findByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('staff@example.com')).toBeInTheDocument();
    expect(within(row('owner@example.com')).getByText('Super admin')).toBeInTheDocument();
    expect(within(row('staff@example.com')).getByText('Admin')).toBeInTheDocument();
  });

  it('marks which row is you', async () => {
    signInAdmin();
    renderPage(<AdminUsersPage />);

    await waitFor(() => expect(within(row('owner@example.com')).getByText('You')).toBeInTheDocument());
    expect(within(row('staff@example.com')).queryByText('You')).not.toBeInTheDocument();
  });

  /**
   * Hiding the controls is courtesy, not security — the server refuses either way. But a
   * button that always fails is worse than no button.
   */
  it('offers no way to add or remove when you are not a super admin', async () => {
    signInAdmin({ superAdmin: false });
    renderPage(<AdminUsersPage />);

    await waitFor(() => expect(screen.getByText('owner@example.com')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /add admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.getByText(/reserved for super admins/i)).toBeInTheDocument();
  });

  it('lets a super admin add one, and shows the password exactly once', async () => {
    signInAdmin();
    renderPage(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByText('owner@example.com')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add admin/i }));
    await userEvent.type(screen.getByPlaceholderText('Jane Smith'), 'New Person');
    await userEvent.type(screen.getByPlaceholderText('jane@example.com'), 'new@example.com');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    // The generated password is the only thing the server will never say again.
    expect(await screen.findByText('TempPass1234')).toBeInTheDocument();
    expect(screen.getByText(/cannot be shown again/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    // And the roster reloaded, rather than the new admin only existing in the response.
    // Scoped to the table: the modal names the same address.
    const table = document.querySelector('.ant-table') as HTMLElement;
    await waitFor(() => expect(within(table).getByText('new@example.com')).toBeInTheDocument());
  });

  it('surfaces a refusal from the server verbatim', async () => {
    signInAdmin();
    renderPage(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByText('owner@example.com')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add admin/i }));
    await userEvent.type(screen.getByPlaceholderText('Jane Smith'), 'Impostor');
    await userEvent.type(screen.getByPlaceholderText('jane@example.com'), 'staff@example.com');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    // Which email is taken is the useful part; a generic message throws that away.
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('will not create an admin without a valid email', async () => {
    signInAdmin();
    renderPage(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByText('owner@example.com')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add admin/i }));
    await userEvent.type(screen.getByPlaceholderText('Jane Smith'), 'New Person');
    await userEvent.type(screen.getByPlaceholderText('jane@example.com'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
  });

  /** Removing yourself is almost always a misclick, so the button is not offered. */
  it('offers no Remove on your own row', async () => {
    signInAdmin();
    renderPage(<AdminUsersPage />);

    await waitFor(() => expect(screen.getByText('owner@example.com')).toBeInTheDocument());
    expect(within(row('owner@example.com')).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    expect(within(row('staff@example.com')).getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('removes another admin once the confirmation is accepted', async () => {
    signInAdmin();
    renderPage(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByText('staff@example.com')).toBeInTheDocument());

    await userEvent.click(within(row('staff@example.com')).getByRole('button', { name: /remove/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^remove$/i }));

    await waitFor(() => expect(screen.queryByText('staff@example.com')).not.toBeInTheDocument());
  });

  it('says so when the roster cannot be loaded', async () => {
    signInAdmin();
    server.use(http.get('/api/admin/admins', () => new HttpResponse(null, { status: 500 })));
    renderPage(<AdminUsersPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
