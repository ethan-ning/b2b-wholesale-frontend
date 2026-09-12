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
  /**
   * Arriving at the page used to show an empty table with no sign anything was coming:
   * the hook started out not-loading, so the first fetch went unannounced and the screen
   * read as "there is nothing here" until it filled in.
   */
  it('says it is loading on arrival, rather than showing an empty table', async () => {
    server.use(http.get('/api/admin/inventory', async () => {
      await new Promise((r) => setTimeout(r, 60));
      return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 20 });
    }));

    renderPage(<InventoryPage />);

    expect(document.querySelector('.ant-spin-spinning')).toBeInTheDocument();
    expect(screen.queryByText(/No data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no skus match/i)).not.toBeInTheDocument();

    // And once it has an answer, it says so plainly.
    expect(await screen.findByText(/no skus match/i)).toBeInTheDocument();
    expect(document.querySelector('.ant-spin-spinning')).not.toBeInTheDocument();
  });

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
