import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ProductDetailPage from './ProductDetailPage';
import { server } from '../test/server';
import { renderPage, signIn } from '../test/render';

const open = (spuCode: string) =>
  renderPage(<ProductDetailPage />, { route: `/products/${spuCode}`, path: '/products/:spuCode' });

beforeEach(signIn);

describe('ProductDetailPage', () => {
  it('shows the product and every SKU under it', async () => {
    open('H1F85N4-H50');

    // By role: the name is deliberately in the breadcrumb as well as the heading.
    expect(await screen.findByRole('heading', { name: /Chrome Hubcap – Dome, 4-Clip/ })).toBeInTheDocument();
    expect(screen.getByText('H1F85N4-H50-1')).toBeInTheDocument();
    expect(screen.getByText('H1F85N4-H50-2')).toBeInTheDocument();
    expect(screen.getByText('H1F85N4-H50-6')).toBeInTheDocument();
  });

  /** The headline is the dealer's own lowest price, not the SPU's list price. */
  it('leads with the cheapest price this dealer actually pays', async () => {
    open('H1F85N4-H50');

    expect(await screen.findByText(/Your price from/i)).toBeInTheDocument();
    // The same figure also appears in the SKU table below, so pick the headline out by
    // the class that styles it rather than by its text.
    const headline = document.querySelector('.dealer-price');
    expect(headline).toHaveTextContent('$9.24');
  });

  it('shows per-unit pricing so a pack can be compared with a single', async () => {
    open('H1F85N4-H50');

    await waitFor(() => expect(screen.getByText('$24.19')).toBeInTheDocument());
    expect(screen.getByText('$4.03/ea')).toBeInTheDocument();
  });

  it('shows stock and what is on its way', async () => {
    open('H1F85N4-H50');

    await waitFor(() => expect(screen.getByText('405')).toBeInTheDocument());
    expect(screen.getByText('+300')).toBeInTheDocument();
  });

  it('places the product in the category tree it belongs to', async () => {
    open('H1F85N4-H50');

    await waitFor(() => expect(screen.getByText('Hub Caps')).toBeInTheDocument());
  });

  it('says so when the product does not exist, instead of rendering an empty page', async () => {
    open('NO-SUCH-SPU');

    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
  });

  it('reports a failure rather than spinning forever', async () => {
    server.use(http.get('/api/products/:spuCode', () => new HttpResponse(null, { status: 500 })));
    open('H1F85N4-H50');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
