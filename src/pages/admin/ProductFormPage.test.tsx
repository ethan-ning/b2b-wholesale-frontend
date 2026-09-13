import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ProductFormPage from './ProductFormPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';
import { ALL_DISCONTINUED, HUBCAP, TIER_PRICES } from '../../test/fixtures';

const open = () =>
  renderPage(<ProductFormPage />, { route: '/admin/products/1/edit', path: '/admin/products/:id/edit' });

/** A SKU's default price box, by the row it sits in. Everything else follows it. */
const defaultPrice = (sku: string = 'H1F85N4-H50-1') => {
  const row = pricingSection().getByText(sku).closest('tr') as HTMLElement;
  return within(row).getAllByRole('spinbutton')[0] as HTMLInputElement;
};
const saveButtons = () => screen.getAllByRole('button', { name: /save this section/i });

/**
 * The price grid, scoped. Every SKU also appears in the gallery's main-image picker, so
 * an unscoped query on a SKU code now matches two places on the page.
 */
const pricingSection = () =>
  within(document.querySelector('.section-card--pricing') as HTMLElement);

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('ProductFormPage', () => {
  it('shows the product identity, which the ERP owns and the portal only displays', async () => {
    open();

    // The SPU appears in the page title and again in the identity table.
    expect((await screen.findAllByText('H1F85N4-H50')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chrome Hubcap – Dome, 4-Clip/).length).toBeGreaterThan(0);
    // Name and SPU are read-only here: they come from the supplier.
    expect(screen.queryByDisplayValue('Chrome Hubcap – Dome, 4-Clip')).not.toBeInTheDocument();
  });

  it('lists each SKU once, with what it lists at', async () => {
    open();

    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-1')).toBeInTheDocument());
    expect(pricingSection().getByText('H1F85N4-H50-2')).toBeInTheDocument();
    expect(pricingSection().getByText('H1F85N4-H50-6')).toBeInTheDocument();
    // One row per SKU, not one per SKU per tier.
    expect(pricingSection().getAllByText(/^H1F85N4-H50-/)).toHaveLength(3);
  });

  /**
   * Each section saves on its own, so a half-finished edit in one does not travel with a
   * deliberate save in another. Nothing is dirty on arrival.
   */
  /**
   * Tier prices are not in the grid. They used to be — three rows per SKU, with the rest
   * merged down across them — and the usual answer on every one of them is "whatever the
   * tier's rate gives", which is not worth twelve rows of saying.
   */
  it('does not show tier prices until they are asked for', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-1')).toBeInTheDocument());

    expect(pricingSection().queryByText('Gold')).not.toBeInTheDocument();
    expect(pricingSection().queryByText('Silver')).not.toBeInTheDocument();
    // Each SKU row carries its default price and its MAP, and nothing else.
    expect(pricingSection().getAllByRole('spinbutton')).toHaveLength(6);
  });

  it('opens the tiers underneath a SKU, showing what each pays', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-2')).toBeInTheDocument());

    await userEvent.click(pricingSection().getAllByRole('button', { name: /expand row/i })[1]);

    expect(await pricingSection().findByText('Gold')).toBeInTheDocument();
    // 9.24 whatever the pack holds; Silver takes 7% off.
    expect(pricingSection().getByText('$8.59')).toBeInTheDocument();
    expect(pricingSection().getAllByText('rate').length).toBeGreaterThan(0);
  });

  it('offers a box only once a custom price is asked for', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-2')).toBeInTheDocument());
    await userEvent.click(pricingSection().getAllByRole('button', { name: /expand row/i })[1]);
    await pricingSection().findByText('Gold');
    const before = pricingSection().getAllByRole('spinbutton').length;

    await userEvent.click(pricingSection().getAllByRole('button', { name: /set a custom price/i })[0]);

    expect(pricingSection().getAllByRole('spinbutton').length).toBe(before + 1);
  });

  /**
   * The whole point of changing the base price is to see what it does. Waiting for a save
   * and a reload to find out is the thing this replaces.
   */
  it('moves a SKU\'s tier prices as its default price is typed', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-1')).toBeInTheDocument());
    await userEvent.click(pricingSection().getAllByRole('button', { name: /expand row/i })[1]);
    // A default price of 9.24; Gold takes 18% off, giving 7.58.
    expect(await pricingSection().findByText('$7.58')).toBeInTheDocument();

    const price = defaultPrice('H1F85N4-H50-2');
    await userEvent.clear(price);
    await userEvent.type(price, '100');

    // Nothing saved, nothing refetched — 100 less 18% is 82, less 7% is 93.
    await waitFor(() => expect(pricingSection().getByText('$82.00')).toBeInTheDocument());
    expect(pricingSection().getByText('$93.00')).toBeInTheDocument();
  });

  /** Every other tier comes off the default price, so there is nothing to depart from. */
  it('will not price a tier before that SKU has a default price', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-2')).toBeInTheDocument());

    await userEvent.clear(defaultPrice('H1F85N4-H50-2'));
    await userEvent.click(pricingSection().getAllByRole('button', { name: /expand row/i })[1]);

    expect(await pricingSection().findByText(/set this sku's default price first/i)).toBeInTheDocument();
    expect(pricingSection().queryByRole('button', { name: /set a custom price/i })).not.toBeInTheDocument();
  });

  /**
   * Opening the box to look is not a change. It used to seed the input with the rate's own
   * figure and mark the row custom, which said a price had been departed from when the
   * number was identical.
   */
  it('does not call a price custom until it actually differs from the rate', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-2')).toBeInTheDocument());
    await userEvent.click(pricingSection().getAllByRole('button', { name: /expand row/i })[1]);
    await pricingSection().findByText('Gold');

    const before = pricingSection().getAllByRole('spinbutton').length;
    await userEvent.click(pricingSection().getAllByRole('button', { name: /set a custom price/i })[0]);

    // A box opened, and the row still says it is on the rate.
    await waitFor(() =>
      expect(pricingSection().getAllByRole('spinbutton').length).toBe(before + 1));
    expect(pricingSection().queryByText('custom')).not.toBeInTheDocument();

    // The box that opened is the one inside the expanded tier panel.
    const panel = document.querySelector('.ant-table-expanded-row') as HTMLElement;
    await userEvent.type(within(panel).getByRole('spinbutton'), '5');

    await waitFor(() => expect(pricingSection().getByText('custom')).toBeInTheDocument());
  });

  /**
   * The two reasons a product cannot be shown are unrelated. Reported as one sentence,
   * the half that did not apply sent someone hunting for a per-SKU price field — which
   * does not exist, because tiers price every SKU.
   */
  it('says a product is blocked because its SKUs are discontinued, not because of pricing', async () => {
    server.use(http.get('/api/admin/products/:id', () =>
      HttpResponse.json({ product: ALL_DISCONTINUED, tierPrices: [], stockByWarehouse: [] })));
    open();

    expect(await screen.findByText(/every sku of this product is discontinued/i)).toBeInTheDocument();
    expect(screen.queryByText(/price/i, { selector: '.ant-alert-description' })).not.toBeInTheDocument();
    // Said on a hidden product too: it cannot be shown either way, and learning that by
    // pressing Visible and being refused is what sent someone looking for a price field.
    expect(screen.getByRole('button', { name: /hidden/i })).toBeInTheDocument();
  });

  it('says a product is blocked for want of a base price, and only that', async () => {
    server.use(http.get('/api/admin/products/:id', () =>
      HttpResponse.json({
        product: { ...HUBCAP, sellable: false, unsellableReason: 'NO_LIST_PRICE' },
        tierPrices: TIER_PRICES,
        stockByWarehouse: [],
      })));
    open();

    expect(await screen.findByText(/no base wholesale price/i)).toBeInTheDocument();
    expect(screen.queryByText(/discontinued/i)).not.toBeInTheDocument();
  });

  /** A product that can be sold should not be warned about anything. */
  it('shows no warning on a product that is fine', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-1')).toBeInTheDocument());

    expect(document.querySelector('.ant-alert-warning')).not.toBeInTheDocument();
  });

  it('offers no save until something has actually changed', async () => {
    open();
    await waitFor(() => expect(saveButtons().length).toBeGreaterThan(0));

    saveButtons().forEach((b) => expect(b).toBeDisabled());
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
  });

  it('marks only the section that was edited as dirty', async () => {
    open();
    await waitFor(() => expect(defaultPrice()).toBeInTheDocument());

    // Held, not re-queried: clearing it removes the value the query matches on.
    const price = defaultPrice();
    await userEvent.clear(price);
    await userEvent.type(price, '11');

    await waitFor(() => expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0));
    // Exactly one section is dirty, so exactly one section save is enabled.
    expect(saveButtons().filter((b) => !b.hasAttribute('disabled'))).toHaveLength(1);
  });

  it('will not let a letter into a price box', async () => {
    open();
    await waitFor(() => expect(defaultPrice()).toBeInTheDocument());

    const price = defaultPrice();
    await userEvent.clear(price);
    await userEvent.type(price, '1a2b');

    expect(price.value).toBe('12');
  });

  it('saves the edited section and reports it', async () => {
    let sent: unknown = null;
    server.use(http.put('/api/admin/products/:id', async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ product: HUBCAP, tierPrices: TIER_PRICES, stockByWarehouse: [] });
    }));
    open();
    await waitFor(() => expect(defaultPrice()).toBeInTheDocument());

    const price = defaultPrice();
    await userEvent.clear(price);
    await userEvent.type(price, '11');
    await userEvent.click(saveButtons().find((b) => !b.hasAttribute('disabled'))!);

    await waitFor(() => expect(sent).not.toBeNull());
    // The SKU's default price, against the anchor tier.
    expect(sent).toMatchObject({
      tierPrices: expect.arrayContaining([
        expect.objectContaining({ sku: 'H1F85N4-H50-1', tierId: 3, price: 11 }),
      ]),
    });
  });

  it('keeps the edit and says what went wrong when the save fails', async () => {
    server.use(http.put('/api/admin/products/:id', () =>
      HttpResponse.json({ message: 'Every SKU on sale needs a price' }, { status: 409 })));
    open();
    await waitFor(() => expect(defaultPrice()).toBeInTheDocument());

    const price = defaultPrice();
    await userEvent.clear(price);
    await userEvent.type(price, '11');
    await userEvent.click(saveButtons().find((b) => !b.hasAttribute('disabled'))!);

    // Reported as a toast, and named: a refusal that says which rule was broken is the
    // difference between fixing it and guessing.
    await waitFor(() =>
      expect(document.querySelector('.ant-message')?.textContent).toMatch(/needs a price/i));
    // The typed value survives, so it can be corrected rather than retyped. Compared as a
    // number: leaving the box formats it to two decimals, which is display, not data.
    expect(Number(defaultPrice().value)).toBe(11);
  });

  /**
   * Clearing the box used to substitute zero, which with two-decimal display left "0.00"
   * sitting there — so retyping a price appended to it and 12 became 0.0012. A price is
   * also the last value that should quietly become zero.
   */
  it('leaves the price box empty when it is cleared, rather than filling it with zero', async () => {
    open();
    await waitFor(() => expect(defaultPrice()).toBeInTheDocument());

    await userEvent.clear(defaultPrice());
    expect(defaultPrice().value).toBe('');

    await userEvent.type(defaultPrice(), '12');
    expect(defaultPrice().value).toBe('12');
  });

  /**
   * Clearing a default price is a request to unprice the SKU, and the API is what decides
   * whether that is allowed — it knows whether the product is on sale. What matters here
   * is that the SKU is left out of the save rather than sent as a zero.
   */
  it('sends no price for a SKU whose default price was cleared', async () => {
    let sent: { tierPrices: { sku: string; tierId: number }[] } | null = null;
    server.use(http.put('/api/admin/products/:id', async ({ request }) => {
      sent = (await request.json()) as { tierPrices: { sku: string; tierId: number }[] };
      return HttpResponse.json({ product: HUBCAP, tierPrices: TIER_PRICES, stockByWarehouse: [] });
    }));
    open();
    await waitFor(() => expect(defaultPrice()).toBeInTheDocument());

    await userEvent.clear(defaultPrice());
    await userEvent.click(saveButtons().find((b) => !b.hasAttribute('disabled'))!);

    await waitFor(() => expect(sent).not.toBeNull());
    const priced = sent!.tierPrices.filter((r) => r.sku === 'H1F85N4-H50-1');
    // Its hand-set Gold price survives; the cleared default is simply absent.
    expect(priced.some((r) => r.tierId === 3)).toBe(false);
  });

  it('says so when the product cannot be loaded', async () => {
    server.use(http.get('/api/admin/products/:id', () => new HttpResponse(null, { status: 404 })));
    open();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('offers visibility as a choice of two, not a checkbox to decode', async () => {
    open();

    await waitFor(() => expect(screen.getByText('Visible')).toBeInTheDocument());
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    const pricing = screen.getByText('Visible').closest('div') as HTMLElement;
    expect(within(pricing).getByText('Visible')).toBeInTheDocument();
  });
});
