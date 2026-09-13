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

/**
 * By its label, not its value: the same figure is also the Gold tier price for the first
 * SKU, and a query on "9.24" matches both.
 */
const basePrice = () => {
  const item = screen.getByText('Base Wholesale Price').closest('.ant-form-item') as HTMLElement;
  return within(item).getByRole('spinbutton') as HTMLInputElement;
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

  it('lists every SKU with a price box per tier', async () => {
    open();

    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-1')).toBeInTheDocument());
    expect(pricingSection().getByText('H1F85N4-H50-2')).toBeInTheDocument();
    expect(pricingSection().getByText('H1F85N4-H50-6')).toBeInTheDocument();
    // Gold and Silver each get their own figure — that is what a tier is.
    expect(screen.getAllByText('Gold').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Silver').length).toBeGreaterThan(0);
  });

  /**
   * Each section saves on its own, so a half-finished edit in one does not travel with a
   * deliberate save in another. Nothing is dirty on arrival.
   */
  /**
   * Every SKU has a price from the moment it is imported — its tier's standing rate — so
   * the grid opens showing prices rather than a box per tier per SKU asking for figures
   * that were already decided.
   */
  it('shows what each tier pays, without a price box for it', async () => {
    open();
    await waitFor(() => expect(pricingSection().getByText('H1F85N4-H50-2')).toBeInTheDocument());

    // 9.24 list on a two-pack is 18.48; Silver takes 7% off.
    expect(pricingSection().getByText('$17.19')).toBeInTheDocument();
    expect(pricingSection().getAllByText('standard').length).toBeGreaterThan(0);

    // One row is genuinely overridden, so that one does show its box.
    const boxes = pricingSection().getAllByRole('spinbutton');
    const priceBoxes = boxes.filter((b) => b.closest('td')?.textContent?.includes('standard $'));
    expect(priceBoxes).toHaveLength(1);
  });

  it('opens a price box only when asked to change one', async () => {
    open();
    await waitFor(() => expect(pricingSection().getAllByText('standard').length).toBeGreaterThan(0));
    const before = pricingSection().getAllByRole('spinbutton').length;

    await userEvent.click(pricingSection().getAllByRole('button', { name: 'Change' })[0]);

    expect(pricingSection().getAllByRole('spinbutton').length).toBe(before + 1);
    // And it says what the figure it replaces was.
    expect(pricingSection().getAllByText(/^standard \$/).length).toBeGreaterThan(0);
  });

  /** A typed price is a different thing from a tier's rate, and has to look like one. */
  it('marks a price someone set apart from the tier rate', async () => {
    open();
    await waitFor(() => expect(pricingSection().getAllByText('custom').length).toBe(1));

    expect(pricingSection().getAllByText('standard').length).toBeGreaterThan(1);
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
    await waitFor(() => expect(pricingSection().getAllByText('standard').length).toBeGreaterThan(0));

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
    await waitFor(() => expect(basePrice()).toBeInTheDocument());

    // Held, not re-queried: clearing it removes the value the query matches on.
    const price = basePrice();
    await userEvent.clear(price);
    await userEvent.type(price, '11');

    await waitFor(() => expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0));
    // Exactly one section is dirty, so exactly one section save is enabled.
    expect(saveButtons().filter((b) => !b.hasAttribute('disabled'))).toHaveLength(1);
  });

  it('will not let a letter into a price box', async () => {
    open();
    await waitFor(() => expect(basePrice()).toBeInTheDocument());

    const price = basePrice();
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
    await waitFor(() => expect(basePrice()).toBeInTheDocument());

    const price = basePrice();
    await userEvent.clear(price);
    await userEvent.type(price, '11');
    await userEvent.click(saveButtons().find((b) => !b.hasAttribute('disabled'))!);

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({ baseWholesalePrice: 11 });
  });

  it('keeps the edit and says what went wrong when the save fails', async () => {
    server.use(http.put('/api/admin/products/:id', () =>
      HttpResponse.json({ message: 'Every SKU on sale needs a price' }, { status: 409 })));
    open();
    await waitFor(() => expect(basePrice()).toBeInTheDocument());

    const price = basePrice();
    await userEvent.clear(price);
    await userEvent.type(price, '11');
    await userEvent.click(saveButtons().find((b) => !b.hasAttribute('disabled'))!);

    // Reported as a toast, and named: a refusal that says which rule was broken is the
    // difference between fixing it and guessing.
    await waitFor(() =>
      expect(document.querySelector('.ant-message')?.textContent).toMatch(/needs a price/i));
    // The typed value survives, so it can be corrected rather than retyped. Compared as a
    // number: leaving the box formats it to two decimals, which is display, not data.
    expect(Number(basePrice().value)).toBe(11);
  });

  /**
   * Clearing the box used to substitute zero, which with two-decimal display left "0.00"
   * sitting there — so retyping a price appended to it and 12 became 0.0012. A price is
   * also the last value that should quietly become zero.
   */
  it('leaves the price box empty when it is cleared, rather than filling it with zero', async () => {
    open();
    await waitFor(() => expect(basePrice()).toBeInTheDocument());

    await userEvent.clear(basePrice());
    expect(basePrice().value).toBe('');

    await userEvent.type(basePrice(), '12');
    expect(basePrice().value).toBe('12');
  });

  it('refuses to save a product with no price at all', async () => {
    open();
    await waitFor(() => expect(basePrice()).toBeInTheDocument());

    await userEvent.clear(basePrice());
    await userEvent.click(saveButtons().find((b) => !b.hasAttribute('disabled'))!);

    await waitFor(() =>
      expect(document.querySelector('.ant-message')?.textContent).toMatch(/price is required/i));
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
