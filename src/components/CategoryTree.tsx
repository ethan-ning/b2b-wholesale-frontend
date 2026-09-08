import { useEffect, useState } from 'react';
import { Tree, Spin, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { fetchCategories } from '../api/catalog';
import type { Category } from '../api/types';

const { Text } = Typography;

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
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories().then((data) => {
      setTreeData(toTreeData(data));
      setLoading(false);
    });
  }, []);

  if (loading) return <Spin size="small" />;

  return (
    <>
      <Text
        type="secondary"
        style={{ fontSize: 12, cursor: 'pointer', display: 'block', marginBottom: 4 }}
        onClick={() => onChange(null, null)}
      >
        All categories
      </Text>
      <Tree
        treeData={treeData}
        selectedKeys={selectedId ? [String(selectedId)] : []}
        onSelect={(keys, info) => {
          // Clicking the selected node deselects it, so `keys` can come back empty.
          const key = keys[0];
          onChange(key ? Number(key) : null, key ? String(info.node.title) : null);
        }}
        defaultExpandAll
        blockNode
      />
    </>
  );
}
