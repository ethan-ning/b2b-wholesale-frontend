import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import DashboardPage from './DashboardPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('DashboardPage', () => {
  it('reports the catalogue and dealer figures', async () => {
    renderPage(<DashboardPage />);

    expect(await screen.findByText('259')).toBeInTheDocument();
    expect(screen.getByText('257')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('205')).toBeInTheDocument();
  });

  it('says the figures are unavailable rather than showing zeroes', async () => {
    server.use(http.get('/api/admin/dashboard', () => new HttpResponse(null, { status: 500 })));
    renderPage(<DashboardPage />);

    // Zero products and a failed request are very different situations.
    await waitFor(() => expect(screen.queryByText('259')).not.toBeInTheDocument());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
