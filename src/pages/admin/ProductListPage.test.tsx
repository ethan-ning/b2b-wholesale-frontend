import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ProductListPage from './ProductListPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';
import { HUBCAP } from '../../test/fixtures';

const row = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('ProductListPage', () => {
  it('lists products with their SPU and visibility', async () => {
    renderPage(<ProductListPage />);

    expect(await screen.findByText('H1F85N4-H50')).toBeInTheDocument();
    expect(within(row('H1F85N4-H50')).getByText(/visible/i)).toBeInTheDocument();
  });

  it('shows how many SKUs sit under each product', async () => {
    renderPage(<ProductListPage />);

    await waitFor(() => expect(screen.getByText('H1F85N4-H50')).toBeInTheDocument());
    expect(within(row('H1F85N4-H50')).getByText('3')).toBeInTheDocument();
  });

  it('narrows the list to a search term', async () => {
    renderPage(<ProductListPage />);
    await waitFor(() => expect(screen.getByText('H1F85N4-H50')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'mud');

    await waitFor(() => expect(screen.queryByText('H1F85N4-H50')).not.toBeInTheDocument());
    expect(screen.getByText('MF-200')).toBeInTheDocument();
  });

  /**
   * A product with an unpriced SKU cannot be shown to dealers — it would be offered at
   * its base price, which for an ERP import is zero. The list has to say so, because the
   * only other clue is a toggle that refuses to move.
   */
  it('marks a product that cannot be made visible', async () => {
    server.use(http.get('/api/admin/products', () =>
      HttpResponse.json({
        content: [{ ...HUBCAP, visibility: 'HIDDEN', sellable: false }],
        totalElements: 1, totalPages: 1, page: 0, size: 10,
      })));
    renderPage(<ProductListPage />);

    expect(await screen.findByText(/unpriced/i)).toBeInTheDocument();
  });

  it('says the list failed rather than showing an empty table', async () => {
    server.use(http.get('/api/admin/products', () => new HttpResponse(null, { status: 500 })));
    renderPage(<ProductListPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
