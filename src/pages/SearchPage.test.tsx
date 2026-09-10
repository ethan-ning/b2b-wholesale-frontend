import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import SearchPage from './SearchPage';
import { server } from '../test/server';
import { renderPage, signIn } from '../test/render';

const rows = () => screen.getAllByRole('link', { name: /Hubcap|Light Panel|Mud Flap/ });
const rowNames = () => rows().map((a) => a.textContent);

beforeEach(signIn);

describe('SearchPage', () => {
  it('lists every product when nothing is filtered', async () => {
    renderPage(<SearchPage />, { route: '/search', path: '/search' });

    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.getByText(/\(3 found\)/)).toBeInTheDocument();
  });

  /**
   * The point of the list layout over a shop grid: a dealer decides from the SKU table
   * without opening anything. If these disappear the page has quietly become a storefront.
   */
  it('shows each SKU with its price and stock, not just a headline figure', async () => {
    renderPage(<SearchPage />, { route: '/search', path: '/search' });
    await waitFor(() => expect(rows()).toHaveLength(3));

    expect(screen.getByText('H1F85N4-H50-1')).toBeInTheDocument();
    expect(screen.getByText('H1F85N4-H50-2')).toBeInTheDocument();
    expect(screen.getByText('H1F85N4-H50-6')).toBeInTheDocument();
    // Pack pricing, and the per-unit figure that makes a 6-pack comparable to a single.
    expect(screen.getByText('$24.19')).toBeInTheDocument();
    expect(screen.getByText('$4.03/ea')).toBeInTheDocument();
    // Stock, including what is on its way.
    expect(screen.getByText('405')).toBeInTheDocument();
    expect(screen.getByText('+300')).toBeInTheDocument();
  });

  it('narrows to a search term and says so in a chip', async () => {
    renderPage(<SearchPage />, { route: '/search?q=hubcap', path: '/search' });

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rowNames()[0]).toMatch(/Hubcap/);
    expect(screen.getByText(/Search: hubcap/)).toBeInTheDocument();
  });

  it('filters by price and offers a way back', async () => {
    renderPage(<SearchPage />, { route: '/search', path: '/search' });
    await waitFor(() => expect(rows()).toHaveLength(3));

    await userEvent.type(screen.getByPlaceholderText('Min'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    // Only the light panel starts above $10.
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rowNames()[0]).toMatch(/Light Panel/);
    expect(screen.getByText(/Price: \$10/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(rows()).toHaveLength(3));
  });

  it('will not let a letter into the price box', async () => {
    renderPage(<SearchPage />, { route: '/search', path: '/search' });
    await waitFor(() => expect(rows()).toHaveLength(3));

    const min = screen.getByPlaceholderText('Min') as HTMLInputElement;
    await userEvent.type(min, 'ab10cd');

    expect(min.value).toBe('10');
  });

  it('filters by category from the sidebar', async () => {
    renderPage(<SearchPage />, { route: '/search', path: '/search' });
    await waitFor(() => expect(rows()).toHaveLength(3));

    // Level 2 is on screen without expanding anything; level 3 is not.
    expect(screen.getByText('Wheels & Hubs')).toBeInTheDocument();
    expect(screen.queryByText('Hub Caps')).not.toBeInTheDocument();

    await userEvent.click(document.querySelectorAll('.ant-tree-switcher')[1]);
    await userEvent.click(await screen.findByText('Hub Caps'));

    await waitFor(() => expect(screen.getByText(/Category: Hub Caps/)).toBeInTheDocument());
  });

  it('drops the sidebar filters when a new term is searched', async () => {
    const { rerender } = renderPage(<SearchPage />, { route: '/search', path: '/search' });
    await waitFor(() => expect(rows()).toHaveLength(3));

    await userEvent.type(screen.getByPlaceholderText('Min'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.getByText(/Price: \$10/)).toBeInTheDocument());

    void rerender;
    // A stale filter silently narrowing a fresh search, often to nothing, is the bug
    // this guards against.
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
    await waitFor(() => expect(screen.queryByText(/Price: \$10/)).not.toBeInTheDocument());
    await waitFor(() => expect(rows()).toHaveLength(3));
  });

  it('says so, with a way out, when nothing matches', async () => {
    renderPage(<SearchPage />, { route: '/search?q=nothing-matches-this', path: '/search' });

    expect(await screen.findByText(/No products match your filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear all and show every product/i })).toBeInTheDocument();
  });

  it('marks a product with nothing on the shelf', async () => {
    renderPage(<SearchPage />, { route: '/search?q=mud', path: '/search' });

    await waitFor(() => expect(rows()).toHaveLength(1));
    const row = rows()[0].closest('.result-row') as HTMLElement;
    expect(within(row).getByText(/out of stock/i)).toBeInTheDocument();
  });

  /**
   * This test found the bug it now guards. The hook had no catch, so a failed request
   * went nowhere: the list stayed empty and the page said "No products match your
   * filters" — a dead API and a search that matched nothing were the same screen.
   */
  it('says the catalogue failed, rather than showing it as empty', async () => {
    server.use(http.get('/api/products', () => new HttpResponse(null, { status: 500 })));
    renderPage(<SearchPage />, { route: '/search', path: '/search' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load/i);
    expect(screen.queryByText(/No products match your filters/i)).not.toBeInTheDocument();
    // The filters stay on screen, so the dealer can retry rather than start over.
    expect(screen.getByPlaceholderText('Min')).toBeInTheDocument();
  });
});
