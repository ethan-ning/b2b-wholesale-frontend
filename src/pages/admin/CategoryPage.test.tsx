import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import CategoryPage from './CategoryPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

/**
 * The tree is an antd Tree, not a table, so a "row" is the node's own wrapper. The action
 * buttons carry `title` rather than an accessible name, so they are found by that.
 */
const row = (name: string) =>
  screen.getByText(name).closest('.ant-tree-node-content-wrapper') as HTMLElement;

const action = (name: string, title: string) =>
  row(name).querySelector(`[title="${title}"]`) as HTMLElement | null;

/** A disabled antd Button is rendered without its title, so absence means unavailable. */
const disabledAction = (name: string, icon: string) =>
  row(name).querySelector(`.anticon-${icon}`)?.closest('button') as HTMLButtonElement | null;

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('CategoryPage', () => {
  it('shows the tree, all three levels of it', async () => {
    renderPage(<CategoryPage />);

    expect(await screen.findByText('Truck Accessories')).toBeInTheDocument();
    expect(screen.getByText('Wheels & Hubs')).toBeInTheDocument();
    expect(screen.getByText('Hub Caps')).toBeInTheDocument();
  });

  /**
   * The taxonomy is capped at three levels. The cap is the server's, and the page has to
   * reflect it — offering an Add on a leaf would produce a refusal and nothing else.
   */
  it('offers no Add on a category already at the deepest level', async () => {
    renderPage(<CategoryPage />);
    await waitFor(() => expect(screen.getByText('Hub Caps')).toBeInTheDocument());

    expect(action('Truck Accessories', 'Add sub-category')).toBeInTheDocument();
    // At the cap the control is still shown, but disabled, with a tooltip saying why.
    expect(action('Hub Caps', 'Add sub-category')).toBeNull();
    expect(disabledAction('Hub Caps', 'plus')).toBeDisabled();
  });

  /** Only sub-categories block a delete; products are unfiled, not deleted with it. */
  it('refuses to delete a category that still has sub-categories, and says why', async () => {
    renderPage(<CategoryPage />);
    await waitFor(() => expect(screen.getByText('Truck Accessories')).toBeInTheDocument());

    expect(action('Hub Caps', 'Delete')).toBeInTheDocument();
    expect(action('Truck Accessories', 'Delete')).toBeNull();
    expect(disabledAction('Truck Accessories', 'delete')).toBeDisabled();
  });

  it('shows how many products sit under each node', async () => {
    renderPage(<CategoryPage />);

    await waitFor(() => expect(screen.getByText('Hub Caps')).toBeInTheDocument());
    // A leaf shows its own count; a parent also shows the distinct total beneath it.
    expect(within(row('Hub Caps')).getByText('4')).toBeInTheDocument();
    expect(within(row('Truck Accessories')).getByText(/8 in total/)).toBeInTheDocument();
  });

  it('says the tree failed rather than showing an empty page', async () => {
    server.use(http.get('/api/admin/categories', () => new HttpResponse(null, { status: 500 })));
    renderPage(<CategoryPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
