import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  /**
   * Only the selected photograph is on screen at size; the rest are members of the same
   * preview group, so the lightbox can arrow through all of them without leaving the page.
   */
  it('shows one image at a time from a gallery the lightbox can page through', async () => {
    open('H1F85N4-H50');
    await screen.findByRole('heading', { name: /Chrome Hubcap/ });

    const shown = Array.from(document.querySelectorAll('.ant-image-img'))
      .filter((img) => (img.closest('.ant-image') as HTMLElement)?.style.display !== 'none');
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveAttribute('src', 'https://cdn.test/hubcap-dome.png');

    // Both photographs are thumbnails beneath it.
    const thumbs = Array.from(document.querySelectorAll('img:not(.ant-image-img)'))
      .map((img) => (img as HTMLImageElement).getAttribute('src'));
    expect(thumbs).toContain('https://cdn.test/hubcap-flat.png');
  });

  /** A SKU's own photo beside its row, because these SKUs are different-looking parts. */
  it('shows each SKU its own main image when they differ', async () => {
    open('H1F85N4-H50');
    await screen.findByRole('heading', { name: /Chrome Hubcap/ });

    const row = screen.getByText('H1F85N4-H50-2').closest('tr') as HTMLElement;
    expect(row.querySelector('.sku-thumb')).toHaveAttribute('src', 'https://cdn.test/hubcap-flat.png');
  });

  /**
   * The detail page is where a dealer compares one product's SKUs against each other, so
   * the picture column is always there — a column that appears on some products and not
   * others is harder to read than a blank square.
   */
  it('keeps a picture cell on every SKU row, even with nothing to put in it', async () => {
    open('MF-200');
    await screen.findByRole('heading', { name: /Rubber Mud Flap/ });

    const row = screen.getByText('MF-200-1').closest('tr') as HTMLElement;
    const slot = row.querySelector('.sku-thumb');
    expect(slot).toBeInTheDocument();
    expect(slot).toHaveClass('sku-thumb--empty');
  });

  /**
   * Not hidden on a one-photo product: a product that later grows a second image should
   * not change shape underneath the dealer who already learned where to look.
   */
  it('shows the thumbnail rail even when there is a single image', async () => {
    open('PL-9011SS');
    await screen.findByRole('heading', { name: /Light Panel/ });

    expect(screen.getAllByRole('button', { name: /show image \d+ of \d+/i })).toHaveLength(1);
    // One of one is not worth counting at the dealer.
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  /**
   * The control, not just the state behind it: a dealer on a tablet gets no hover, so this
   * button is the only thing that opens the full-size view for them.
   */
  it('opens the full-size view from the control on the image', async () => {
    open('H1F85N4-H50');
    await screen.findByRole('heading', { name: /Chrome Hubcap/ });
    expect(document.querySelector('.ant-image-preview')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /view full size/i }));

    await waitFor(() => expect(document.querySelector('.ant-image-preview')).toBeInTheDocument());
  });

  it('says how many images there are, so a dealer knows to look further', async () => {
    open('H1F85N4-H50');
    await screen.findByRole('heading', { name: /Chrome Hubcap/ });

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('moves the stage to the image whose thumbnail was clicked', async () => {
    open('H1F85N4-H50');
    await screen.findByRole('heading', { name: /Chrome Hubcap/ });

    await userEvent.click(screen.getByRole('button', { name: /show image 2 of 2/i }));

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    const shown = Array.from(document.querySelectorAll('.ant-image-img'))
      .filter((img) => (img.closest('.ant-image') as HTMLElement)?.style.display !== 'none');
    expect(shown[0]).toHaveAttribute('src', 'https://cdn.test/hubcap-flat.png');
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
