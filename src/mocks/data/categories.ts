import type { Category } from '../../api/types';

export const categories: Category[] = [
  {
    id: 1, name: 'Auto Parts', slug: 'auto-parts', parentId: null,
    children: [
      { id: 11, name: 'Exhaust', slug: 'exhaust', parentId: 1, children: [] },
      { id: 12, name: 'Lighting', slug: 'lighting', parentId: 1, children: [] },
    ],
  },
  {
    id: 2, name: 'Apparel', slug: 'apparel', parentId: null,
    children: [
      { id: 21, name: 'Jackets', slug: 'jackets', parentId: 2, children: [] },
      { id: 22, name: 'Gloves', slug: 'gloves', parentId: 2, children: [] },
    ],
  },
  {
    id: 3, name: 'Tools', slug: 'tools', parentId: null,
    children: [
      { id: 31, name: 'Hand Tools', slug: 'hand-tools', parentId: 3, children: [] },
    ],
  },
];
