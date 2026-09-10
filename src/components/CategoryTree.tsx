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

interface Props {
  selectedId: number | null;
  /** `name` accompanies a selection so callers can label it without refetching the tree. */
  onChange: (id: number | null, name: string | null) => void;
}

export default function CategoryTree({ selectedId, onChange }: Props) {
  const { data: categories, loading, error } = useResource(() => fetchCategories(), []);

  // Inline rather than the full-page states: this is a sidebar, and taking over the screen
  // because a filter list failed would hide the results the dealer came for.
  if (loading) return <Spin size="small" />;
  if (error) return <Alert type="warning" message="Categories unavailable" showIcon />;

  const treeData = toTreeData(categories ?? []);

  return (
    <Tree
      treeData={treeData}
      selectedKeys={selectedId ? [String(selectedId)] : []}
      onSelect={(keys, info) => {
        // Clicking the selected node deselects it, which is how the filter gets cleared.
        const key = keys[0];
        onChange(key ? Number(key) : null, key ? String(info.node.title) : null);
      }}
      defaultExpandAll
      blockNode
    />
  );
}
