import { useState } from 'react';
import { Tree, Spin, Alert } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { fetchCategories } from '../api/catalog';
import type { Category } from '../api/types';
import { useResource } from '../hooks/useResource';

function toTreeData(categories: Category[]): DataNode[] {
  return categories.map((c) => ({
    key: String(c.id),
    title: c.name,
    children: c.children.length > 0 ? toTreeData(c.children) : undefined,
  }));
}

/** The top level's own keys — expanding these reveals the second layer and stops. */
function topLevelKeys(categories: Category[]): string[] {
  return categories.filter((c) => c.children.length > 0).map((c) => String(c.id));
}

/** The path from the root down to a category, so a selection can be revealed. */
function pathTo(categories: Category[], target: number, trail: string[] = []): string[] | null {
  for (const c of categories) {
    if (c.id === target) return trail;
    const found = pathTo(c.children, target, [...trail, String(c.id)]);
    if (found) return found;
  }
  return null;
}

interface Props {
  selectedId: number | null;
  /** `name` accompanies a selection so callers can label it without refetching the tree. */
  onChange: (id: number | null, name: string | null) => void;
}

export default function CategoryTree({ selectedId, onChange }: Props) {
  const { data: categories, loading, error } = useResource(() => fetchCategories(), []);
  const [expanded, setExpanded] = useState<string[] | null>(null);

  // Inline rather than the full-page states: this is a sidebar, and taking over the screen
  // because a filter list failed would hide the results the dealer came for.
  if (loading) return <Spin size="small" />;
  if (error) return <Alert type="warning" message="Categories unavailable" showIcon />;

  const tree = categories ?? [];

  /*
   * Two layers open, not all three. Fully expanded, 38 leaves under 14 parents is a wall
   * of forty-odd lines with no shape to it — the groupings that make it navigable are
   * exactly what disappears. Opening the top level shows the shape and lets the dealer
   * choose where to go deeper.
   *
   * A category chosen from elsewhere (a product's breadcrumb) still opens its own branch,
   * because a selection nobody can see is worse than an extra open node.
   */
  const initial = [
    ...topLevelKeys(tree),
    ...(selectedId ? (pathTo(tree, selectedId) ?? []) : []),
  ];
  const expandedKeys = expanded ?? Array.from(new Set(initial));

  return (
    <Tree
      treeData={toTreeData(tree)}
      selectedKeys={selectedId ? [String(selectedId)] : []}
      expandedKeys={expandedKeys}
      onExpand={(keys) => setExpanded(keys as string[])}
      onSelect={(keys, info) => {
        // Clicking the selected node deselects it, which is how the filter gets cleared.
        const key = keys[0];
        onChange(key ? Number(key) : null, key ? String(info.node.title) : null);
      }}
      blockNode
    />
  );
}
