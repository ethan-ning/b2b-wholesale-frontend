import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ImageListPage from './ImageListPage';
import { server } from '../../test/server';
import { renderPage, signInAdmin, signOutAdmin } from '../../test/render';

const open = () => renderPage(<ImageListPage />, { route: '/admin/images' });

/** The row for one file, by its name — every assertion here is about one image. */
const row = (filename: string) =>
  within(screen.getByText(filename).closest('tr') as HTMLElement);

beforeEach(() => {
  signOutAdmin();
  signInAdmin();
});

describe('ImageListPage', () => {
  it('lists every image with its size and what uses it', async () => {
    open();

    await screen.findByText('hubcap-dome.png');
    expect(row('hubcap-dome.png').getByText('180 KB')).toBeInTheDocument();
    expect(row('hubcap-dome.png').getByText('1200×1200')).toBeInTheDocument();
    // Which SPU holds it — the column the screen exists for.
    expect(row('hubcap-dome.png').getByText('H1F85N4-H50')).toBeInTheDocument();
    expect(row('spare-bracket.jpg').getByText('Unused')).toBeInTheDocument();
  });

  /**
   * The rule the whole screen is arranged around. Disabled rather than hidden, so an
   * admin looking for the delete finds it and learns why it will not go.
   */
  it('offers delete only on an image nothing shows', async () => {
    open();
    await screen.findByText('hubcap-dome.png');

    expect(row('hubcap-dome.png').getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(row('spare-bracket.jpg').getByRole('button', { name: /delete/i })).toBeEnabled();
  });

  it('removes a deleted image from the list', async () => {
    open();
    await screen.findByText('spare-bracket.jpg');

    await userEvent.click(row('spare-bracket.jpg').getByRole('button', { name: /delete/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('spare-bracket.jpg')).not.toBeInTheDocument());
    // The two that are in use are untouched.
    expect(screen.getByText('hubcap-dome.png')).toBeInTheDocument();
  });

  /** A refusal names the products still holding the file; a generic message would not. */
  it('repeats the API refusal when a delete is rejected', async () => {
    server.use(
      http.delete('/api/admin/images/:id', () =>
        HttpResponse.json({ message: 'Still used by 1 product: H1F85N4-H50' }, { status: 400 })),
    );
    open();
    await screen.findByText('spare-bracket.jpg');

    await userEvent.click(row('spare-bracket.jpg').getByRole('button', { name: /delete/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/Still used by 1 product: H1F85N4-H50/)).toBeInTheDocument();
    expect(screen.getByText('spare-bracket.jpg')).toBeInTheDocument();
  });

  it('filters to the images nothing is using', async () => {
    open();
    await screen.findByText('hubcap-dome.png');

    await userEvent.click(screen.getByRole('checkbox', { name: /unused only/i }));

    expect(screen.getByText('spare-bracket.jpg')).toBeInTheDocument();
    expect(screen.queryByText('hubcap-dome.png')).not.toBeInTheDocument();
  });

  /** Searching by SPU, because "which images belong to this product" is the other question. */
  it('searches filenames and the products using them', async () => {
    open();
    await screen.findByText('hubcap-dome.png');

    await userEvent.type(screen.getByPlaceholderText(/filename, spu/i), 'bracket');
    expect(screen.queryByText('hubcap-dome.png')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(/filename, spu/i));
    await userEvent.type(screen.getByPlaceholderText(/filename, spu/i), 'H1F85N4');
    expect(screen.getByText('hubcap-dome.png')).toBeInTheDocument();
    expect(screen.queryByText('spare-bracket.jpg')).not.toBeInTheDocument();
  });

  it('shows an uploaded file in the list without a page reload', async () => {
    open();
    await screen.findByText('hubcap-dome.png');

    const file = new File(['x'], 'new-part.png', { type: 'image/png' });
    // The hidden input antd's Upload renders — there is no button to click that reaches it.
    await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(await screen.findByText('new-part.png')).toBeInTheDocument();
  });

  /**
   * A screenful, not the catalogue. The whole library is a few hundred kilobytes with a
   * usage list on every row, so fetching it to show a page made the first paint wait on
   * all of it.
   */
  it('asks for one page rather than the whole library', async () => {
    const asked: URL[] = [];
    server.use(http.get('/api/admin/images', ({ request }) => {
      asked.push(new URL(request.url));
      return HttpResponse.json({ content: [], totalElements: 0, totalPages: 1, page: 0, size: 24, unusedCount: 0 });
    }));
    open();

    await waitFor(() => expect(asked.length).toBeGreaterThan(0));
    expect(asked[0].searchParams.get('size')).toBe('24');
    expect(asked[0].searchParams.get('page')).toBe('0');
  });

  it('renders only the page it was given, and says how many there are in total', async () => {
    server.use(http.get('/api/admin/images', ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
      return HttpResponse.json({
        content: [{
          image: { id: 900 + page, url: 'https://cdn.test/p.png', filename: `page-${page}-file.png`,
                   contentType: 'image/png', bytes: 1024, width: 10, height: 10, altText: null, stored: true },
          usedBy: [], deletable: true,
        }],
        totalElements: 50, totalPages: 50, page, size: 24, unusedCount: 50,
      });
    }));
    open();

    expect(await screen.findByText('page-0-file.png')).toBeInTheDocument();
    expect(screen.getByText('50 images')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Next Page'));

    expect(await screen.findByText('page-1-file.png')).toBeInTheDocument();
    expect(screen.queryByText('page-0-file.png')).not.toBeInTheDocument();
  });

  /** Filtering in the browser would only ever have searched the rows already fetched. */
  it('sends the search to the API instead of filtering what is on screen', async () => {
    const asked: string[] = [];
    server.use(http.get('/api/admin/images', ({ request }) => {
      asked.push(new URL(request.url).searchParams.get('search') ?? '');
      return HttpResponse.json({ content: [], totalElements: 0, totalPages: 1, page: 0, size: 24, unusedCount: 0 });
    }));
    open();
    await waitFor(() => expect(asked.length).toBeGreaterThan(0));

    await userEvent.type(screen.getByPlaceholderText(/filename, spu/i), 'hubcap');

    await waitFor(() => expect(asked).toContain('hubcap'));
  });

  it('sends the unused filter to the API too', async () => {
    const asked: (string | null)[] = [];
    server.use(http.get('/api/admin/images', ({ request }) => {
      asked.push(new URL(request.url).searchParams.get('unusedOnly'));
      return HttpResponse.json({ content: [], totalElements: 0, totalPages: 1, page: 0, size: 24, unusedCount: 7 });
    }));
    open();
    await waitFor(() => expect(asked.length).toBeGreaterThan(0));

    await userEvent.click(screen.getByRole('checkbox', { name: /unused only/i }));

    await waitFor(() => expect(asked).toContain('true'));
    // The count is the library's, so it does not shrink to whatever this page holds.
    expect(screen.getByRole('checkbox', { name: /unused only \(7\)/i })).toBeInTheDocument();
  });

  /**
   * Laid out from the declared widths. Sized from content instead, every column shifted
   * on each page change — one longer filename moved the whole table sideways.
   */
  it('keeps its columns in the same place from one page to the next', async () => {
    open();
    await screen.findByText('hubcap-dome.png');

    const table = document.querySelector('.ant-table-tbody')?.closest('table') as HTMLElement;
    expect(getComputedStyle(table).tableLayout).toBe('fixed');
  });

  it('reports a load failure instead of showing an empty library', async () => {
    server.use(http.get('/api/admin/images', () => new HttpResponse(null, { status: 500 })));
    open();

    expect(await screen.findByText(/failed to load the image library/i)).toBeInTheDocument();
  });
});
