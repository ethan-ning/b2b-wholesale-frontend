import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import CustomerListPage from './CustomerListPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

const row = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('CustomerListPage', () => {
  it('lists dealers with the tier that decides their prices', async () => {
    renderPage(<CustomerListPage />);

    expect(await screen.findByText('dealer1@example.com')).toBeInTheDocument();
    expect(within(row('dealer1@example.com')).getByText('Gold')).toBeInTheDocument();
    expect(within(row('dealer2@example.com')).getByText('Silver')).toBeInTheDocument();
  });

  it('distinguishes a disabled dealer from an active one', async () => {
    renderPage(<CustomerListPage />);

    await waitFor(() => expect(screen.getByText('dealer2@example.com')).toBeInTheDocument());
    // Status is a switch rather than a label — a disabled dealer cannot sign in, and the
    // control that says so is also the one that changes it.
    expect(within(row('dealer1@example.com')).getByRole('switch')).toBeChecked();
    expect(within(row('dealer2@example.com')).getByRole('switch')).not.toBeChecked();
  });

  it('narrows the list to a search term', async () => {
    renderPage(<CustomerListPage />);
    await waitFor(() => expect(screen.getByText('dealer1@example.com')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Reeve');

    await waitFor(() => expect(screen.queryByText('dealer1@example.com')).not.toBeInTheDocument());
    expect(screen.getByText('dealer2@example.com')).toBeInTheDocument();
  });

  /**
   * The bug this file's sibling hook had: a failed request left the table empty, and an
   * empty table is what "no dealers match" looks like too.
   */
  it('says the list failed rather than showing an empty table', async () => {
    server.use(http.get('/api/admin/customers', () => new HttpResponse(null, { status: 500 })));
    renderPage(<CustomerListPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
