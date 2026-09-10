import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import InventoryPage from './InventoryPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

const row = (sku: string) => screen.getByText(sku).closest('tr') as HTMLElement;

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('InventoryPage', () => {
  it('lists SKUs with what is on hand and what is coming', async () => {
    renderPage(<InventoryPage />);

    expect(await screen.findByText('H1F85N4-H50-2')).toBeInTheDocument();
    const low = within(row('H1F85N4-H50-2'));
    expect(low.getByText('10')).toBeInTheDocument();
    // In transit is Sellfox's 在途, and it is the difference between "reorder now" and
    // "already handled".
    expect(low.getByText(/300/)).toBeInTheDocument();
  });

  it('distinguishes nothing on hand from a little on hand', async () => {
    renderPage(<InventoryPage />);

    await waitFor(() => expect(screen.getByText('H1F85N4-H50-1')).toBeInTheDocument());
    expect(within(row('H1F85N4-H50-1')).getByText(/out of stock|^0$/i)).toBeInTheDocument();
  });

  it('narrows to a searched SKU', async () => {
    renderPage(<InventoryPage />);
    await waitFor(() => expect(screen.getByText('H1F85N4-H50-1')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'H50-2');

    await waitFor(() => expect(screen.queryByText('H1F85N4-H50-1')).not.toBeInTheDocument());
    expect(screen.getByText('H1F85N4-H50-2')).toBeInTheDocument();
  });

  it('says the list failed rather than showing an empty table', async () => {
    server.use(http.get('/api/admin/inventory', () => new HttpResponse(null, { status: 500 })));
    renderPage(<InventoryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
