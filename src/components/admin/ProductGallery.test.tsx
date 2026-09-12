import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ProductGallery from './ProductGallery';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';
import { galleryCalls } from '../../test/adminHandlers';
import { HUBCAP, HUBCAP_IMAGES } from '../../test/fixtures';

const open = (images = HUBCAP_IMAGES) =>
  renderPage(
    <ProductGallery
      productId={HUBCAP.id}
      images={images}
      variants={HUBCAP.variants}
      variantAxis={HUBCAP.variantAxis}
    />,
  );

/** Gallery tiles in the order they are shown, by the file each one points at. */
const tiles = () =>
  Array.from(document.querySelectorAll('.gallery-tile img')).map((img) => (img as HTMLImageElement).src);

const skuRow = (sku: string) => screen.getByText(sku).closest('tr') as HTMLElement;

/** What one SKU's main-image picker currently reads, chosen or not. */
const chosenFor = (sku: string) =>
  skuRow(sku).querySelector('.ant-select-content')?.textContent;

/** Opens a SKU's picker and clicks one option by its label. */
async function choose(sku: string, option: string) {
  await userEvent.click(screen.getByLabelText(`Main image for ${sku}`));
  const match = await waitFor(() => {
    const found = Array.from(document.querySelectorAll('.ant-select-item-option'))
      .find((el) => el.textContent === option);
    if (!found) throw new Error(`No option "${option}"`);
    return found as HTMLElement;
  });
  await userEvent.click(match);
}

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('ProductGallery', () => {
  it('shows the gallery in order, against the limit', async () => {
    open();

    expect(screen.getByText(/2 of 9/)).toBeInTheDocument();
    expect(tiles()).toEqual([
      'https://cdn.test/hubcap-dome.png',
      'https://cdn.test/hubcap-flat.png',
    ]);
    // Position one is what a dealer sees when a SKU has no choice of its own.
    expect(screen.getByText('Cover')).toBeInTheDocument();
  });

  it('sends the whole new order when an image moves', async () => {
    open();

    await userEvent.click(screen.getAllByRole('button', { name: '↓' })[0]);

    await waitFor(() => expect(galleryCalls).toContain('order 1/502,501'));
    expect(tiles()).toEqual([
      'https://cdn.test/hubcap-flat.png',
      'https://cdn.test/hubcap-dome.png',
    ]);
  });

  /** Otherwise the gallery on screen and the gallery on the server quietly disagree. */
  it('puts the order back when the server refuses the move', async () => {
    server.use(
      http.put('/api/admin/products/:id/images/order', () =>
        HttpResponse.json({ message: 'Nope' }, { status: 400 })),
    );
    open();

    await userEvent.click(screen.getAllByRole('button', { name: '↓' })[0]);

    expect(await screen.findByText('Nope')).toBeInTheDocument();
    await waitFor(() => expect(tiles()).toEqual([
      'https://cdn.test/hubcap-dome.png',
      'https://cdn.test/hubcap-flat.png',
    ]));
  });

  it('refuses to add past the limit rather than letting the API say no', async () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
      id: 600 + i, url: `https://cdn.test/p${i}.png`, altText: null, sortOrder: i,
    }));
    open(nine);

    expect(screen.getByRole('button', { name: /add from library/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled();
    expect(screen.getByText(/at the limit/i)).toBeInTheDocument();
  });

  it('uploads a file straight onto the product', async () => {
    open();

    const file = new File(['x'], 'fresh.png', { type: 'image/png' });
    await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    // Uploaded, then attached — two calls, because an image joins the library first.
    await waitFor(() => expect(galleryCalls).toContain('attach 1/900'));
    expect(tiles()).toContain('https://cdn.test/fresh.png');
  });

  /** Re-adding an image a product already shows is not something the picker can do. */
  it('offers only library images this product does not already show', async () => {
    open();

    await userEvent.click(screen.getByRole('button', { name: /add from library/i }));

    expect(await screen.findByText('spare-bracket.jpg')).toBeInTheDocument();
    expect(screen.queryByText('hubcap-dome.png')).not.toBeInTheDocument();
  });

  /**
   * The library runs to hundreds of pictures and the modal holds one page, so without a
   * search most of it would be unreachable from here.
   */
  it('searches the library from the picker rather than only the page it holds', async () => {
    const asked: string[] = [];
    server.use(http.get('/api/admin/images', ({ request }) => {
      asked.push(new URL(request.url).searchParams.get('search') ?? '');
      return HttpResponse.json({ content: [], totalElements: 0, totalPages: 1, page: 0, size: 24, unusedCount: 0 });
    }));
    open();

    await userEvent.click(screen.getByRole('button', { name: /add from library/i }));
    await waitFor(() => expect(asked.length).toBeGreaterThan(0));

    await userEvent.type(screen.getByPlaceholderText(/filename, spu/i), 'bracket');

    await waitFor(() => expect(asked).toContain('bracket'));
  });

  it('adds a picked library image to the gallery', async () => {
    open();

    await userEvent.click(screen.getByRole('button', { name: /add from library/i }));
    await screen.findByText('spare-bracket.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(galleryCalls).toContain('attach 1/503'));
    expect(tiles()).toContain('https://cdn.test/spare-bracket.jpg');
  });

  it('shows which image stands for each SKU', async () => {
    open();

    expect(chosenFor('H1F85N4-H50-1')).toBe('1. Dome hubcap');
    expect(chosenFor('H1F85N4-H50-2')).toBe('2. Flat hubcap');
    // The third SKU has never been given one; "None" is a real state, not a default.
    expect(chosenFor('H1F85N4-H50-6')).toBe('None');
  });

  it('saves a SKU main image as soon as it is chosen', async () => {
    open();

    await choose('H1F85N4-H50-6', '2. Flat hubcap');

    await waitFor(() => expect(galleryCalls).toContain('main 13=502'));
  });

  /**
   * The API clears the pointer when an image leaves a product. The picker has to agree,
   * or it goes on naming a photograph the product no longer shows.
   */
  it('clears the SKU pointer when its image is detached', async () => {
    open();

    await userEvent.click(screen.getByRole('button', { name: /remove image 1 /i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(galleryCalls).toContain('detach 1/501'));
    await waitFor(() => expect(chosenFor('H1F85N4-H50-1')).toBe('None'));
    expect(tiles()).toEqual(['https://cdn.test/hubcap-flat.png']);
  });

  it('says there are no images rather than showing an empty grid', () => {
    open([]);

    expect(screen.getByText(/no images on this product yet/i)).toBeInTheDocument();
  });
});
