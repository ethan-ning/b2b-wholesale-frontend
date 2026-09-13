import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import TierPricingPage from './TierPricingPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

const open = () => renderPage(<TierPricingPage />, { route: '/admin/tiers' });
const row = (tier: string) => within(screen.getByText(tier).closest('tr') as HTMLElement);

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('TierPricingPage', () => {
  it('lists each tier with the rate it pays', async () => {
    open();

    await screen.findByText('Gold');
    expect(row('Gold').getByRole('spinbutton')).toHaveValue('18.00');
    expect(row('Silver').getByRole('spinbutton')).toHaveValue('7.00');
    // A tier at nothing off is saying it pays list, which is worth saying out loud.
    expect(row('Default').getByText('pays list')).toBeInTheDocument();
  });

  /** A percentage is hard to feel. A price is not. */
  it('shows what the rate does to a round number', async () => {
    open();
    await screen.findByText('Gold');

    expect(row('Gold').getByText('$82.00')).toBeInTheDocument();
    expect(row('Default').getByText('$100.00')).toBeInTheDocument();
  });

  it('saves a new rate, and offers no save until one is typed', async () => {
    const sent: number[] = [];
    server.use(http.put('/api/admin/tiers/:id/discount', async ({ request }) => {
      const body = (await request.json()) as { discountPercent: number };
      sent.push(body.discountPercent);
      return HttpResponse.json({ id: 1, name: 'Gold', sortOrder: 3, discountPercent: body.discountPercent });
    }));
    open();
    await screen.findByText('Gold');

    expect(row('Gold').getByRole('button', { name: 'Save' })).toBeDisabled();

    const box = row('Gold').getByRole('spinbutton');
    await userEvent.clear(box);
    await userEvent.type(box, '25');
    await userEvent.click(row('Gold').getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent).toEqual([25]));
  });

  /** The refusal names the number, which is the thing that needs correcting. */
  it('repeats the API refusal rather than a generic failure', async () => {
    server.use(http.put('/api/admin/tiers/:id/discount', () =>
      HttpResponse.json({ message: 'A discount must be under 100%: 150' }, { status: 409 })));
    open();
    await screen.findByText('Gold');

    const box = row('Gold').getByRole('spinbutton');
    await userEvent.clear(box);
    await userEvent.type(box, '30');
    await userEvent.click(row('Gold').getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/A discount must be under 100%: 150/)).toBeInTheDocument();
  });

  it('reports a load failure instead of an empty table', async () => {
    server.use(http.get('/api/admin/tiers', () => new HttpResponse(null, { status: 500 })));
    open();

    expect(await screen.findByText(/failed to load the pricing tiers/i)).toBeInTheDocument();
  });
});
