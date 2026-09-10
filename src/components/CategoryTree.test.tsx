import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoryTree from './CategoryTree';
import type { Category } from '../api/types';

vi.mock('../api/catalog', () => ({ fetchCategories: vi.fn() }));
const { fetchCategories } = await import('../api/catalog');

const leaf = (id: number, name: string): Category =>
  ({ id, name, slug: name.toLowerCase(), parentId: null, sortOrder: id, productCount: 0, children: [] }) as Category;

const branch = (id: number, name: string, children: Category[]): Category =>
  ({ ...leaf(id, name), children }) as Category;

/** Three levels, which is the depth the catalogue actually uses. */
const TREE: Category[] = [
  branch(1, 'Truck Accessories', [
    branch(10, 'Wheels & Hubs', [leaf(100, 'Hub Caps'), leaf(101, 'Lug Nut Covers')]),
    branch(11, 'Lighting', [leaf(110, 'Light Bars')]),
  ]),
  branch(2, 'Motorcycle', [branch(20, 'Riding Gear', [leaf(200, 'Riding Gloves')])]),
];

beforeEach(() => {
  vi.mocked(fetchCategories).mockResolvedValue(TREE);
});

describe('CategoryTree', () => {
  /**
   * Fully expanded, thirty-eight leaves under fourteen parents is a forty-line wall in
   * which the groupings that make it navigable are the first thing to disappear.
   */
  it('opens two layers and stops', async () => {
    render(<CategoryTree selectedId={null} onChange={() => {}} />);

    await waitFor(() => expect(screen.getByText('Truck Accessories')).toBeInTheDocument());

    // Level 2 is visible…
    expect(screen.getByText('Wheels & Hubs')).toBeInTheDocument();
    expect(screen.getByText('Riding Gear')).toBeInTheDocument();
    // …level 3 is not.
    expect(screen.queryByText('Hub Caps')).not.toBeInTheDocument();
    expect(screen.queryByText('Riding Gloves')).not.toBeInTheDocument();
  });

  /** A selection nobody can see is worse than an extra open node. */
  it('opens the branch holding a category selected from elsewhere', async () => {
    render(<CategoryTree selectedId={101} onChange={() => {}} />);

    await waitFor(() => expect(screen.getByText('Lug Nut Covers')).toBeInTheDocument());
    // Its ancestors came with it, and unrelated branches stayed shut.
    expect(screen.getByText('Wheels & Hubs')).toBeInTheDocument();
    expect(screen.queryByText('Riding Gloves')).not.toBeInTheDocument();
  });

  it('reports the chosen category and its name', async () => {
    const onChange = vi.fn();
    render(<CategoryTree selectedId={null} onChange={onChange} />);

    await waitFor(() => expect(screen.getByText('Wheels & Hubs')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Wheels & Hubs'));

    expect(onChange).toHaveBeenCalledWith(10, 'Wheels & Hubs');
  });

  it('clears the filter when the selected category is clicked again', async () => {
    const onChange = vi.fn();
    render(<CategoryTree selectedId={10} onChange={onChange} />);

    await waitFor(() => expect(screen.getByText('Wheels & Hubs')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Wheels & Hubs'));

    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('lets the dealer open a third level themselves', async () => {
    render(<CategoryTree selectedId={null} onChange={() => {}} />);

    await waitFor(() => expect(screen.getByText('Wheels & Hubs')).toBeInTheDocument());
    const switcher = document.querySelectorAll('.ant-tree-switcher')[1];
    await userEvent.click(switcher);

    expect(await screen.findByText('Hub Caps')).toBeInTheDocument();
  });

  it('says so inline when the categories cannot be loaded', async () => {
    vi.mocked(fetchCategories).mockRejectedValue(new Error('boom'));
    render(<CategoryTree selectedId={null} onChange={() => {}} />);

    // Inline, not a full-page error: a sidebar failing must not hide the results the
    // dealer came for.
    expect(await screen.findByText(/Categories unavailable/i)).toBeInTheDocument();
  });
});
