import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import AdminAccountPage from './AdminAccountPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

async function changePassword(current: string, next: string, confirm = next) {
  await userEvent.type(screen.getByLabelText('Current password'), current);
  await userEvent.type(screen.getByLabelText('New password'), next);
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
  await userEvent.click(screen.getByRole('button', { name: /change password/i }));
}

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('AdminAccountPage', () => {
  it('shows who you are signed in as', () => {
    renderPage(<AdminAccountPage />);

    expect(screen.getByText('System Admin')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('Super admin')).toBeInTheDocument();
  });

  /** Email is identity and role belongs to a super admin; neither is editable here. */
  it('offers nothing to edit except the password', () => {
    renderPage(<AdminAccountPage />);

    expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
  });

  it('changes the password when the current one is right', async () => {
    renderPage(<AdminAccountPage />);

    await changePassword('admin123', 'BrandNew98765');

    expect(await screen.findByText(/password changed/i)).toBeInTheDocument();
    // The form empties, so the old value is not left sitting in the box.
    await waitFor(() => expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe(''));
  });

  /**
   * An unattended session should not be enough to take an account over, which is why the
   * server asks for the current password even though the caller is already signed in.
   */
  it('refuses when the current password is wrong, and says which one', async () => {
    renderPage(<AdminAccountPage />);

    await changePassword('not-the-one', 'BrandNew98765');

    expect(await screen.findByRole('alert')).toHaveTextContent(/current password is incorrect/i);
  });

  it('catches a mistyped confirmation before asking the server', async () => {
    renderPage(<AdminAccountPage />);

    await changePassword('admin123', 'BrandNew98765', 'BrandNew98764');

    // A typo the server cannot see is exactly what the third box is for.
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
  });

  it('requires a password long enough to be worth having', async () => {
    renderPage(<AdminAccountPage />);

    await userEvent.type(screen.getByLabelText('Current password'), 'admin123');
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('reports a server failure rather than claiming success', async () => {
    server.use(http.post('/api/admin/auth/change-password', () => new HttpResponse(null, { status: 500 })));
    renderPage(<AdminAccountPage />);

    await changePassword('admin123', 'BrandNew98765');

    expect(await screen.findByRole('alert')).toHaveTextContent(/had a problem/i);
    expect(screen.queryByText(/password changed/i)).not.toBeInTheDocument();
  });
});
