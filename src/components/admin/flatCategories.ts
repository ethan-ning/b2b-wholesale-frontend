import type { Category } from '../../api/types';

export type FlatCategory = { id: number; name: string; parentId: number | null; depth: number };

/** The tree, flattened for a checkbox list. Depth is kept so the nesting still reads. */
export function flattenCategories(cats: Category[], depth = 0): FlatCategory[] {
  return cats.flatMap((c) => [
    { id: c.id, name: c.name, parentId: c.parentId, depth },
    ...flattenCategories(c.children, depth + 1),
  ]);
}
