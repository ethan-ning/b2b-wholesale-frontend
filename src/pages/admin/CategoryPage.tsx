import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Button, Input, Space, Spin, Alert, Popconfirm, message, Tree, Card,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import * as api from '../../api/adminApi';
import type { Category } from '../../api/types';

const { Title } = Typography;

function toTreeData(
  cats: Category[],
  editingId: number | null,
  editingName: string,
  handlers: {
    onEdit: (id: number, name: string) => void;
    onSave: (id: number) => void;
    onCancel: () => void;
    onDelete: (id: number) => void;
    onAddChild: (parentId: number) => void;
  }
): DataNode[] {
  return cats.map((c) => ({
    key: String(c.id),
    title:
      editingId === c.id ? (
        <Space>
          <Input
            size="small"
            value={editingName}
            onChange={(e) => handlers.onEdit(c.id, e.target.value)}
            style={{ width: 160 }}
            onPressEnter={() => handlers.onSave(c.id)}
          />
          <Button size="small" icon={<CheckOutlined />} type="primary" onClick={() => handlers.onSave(c.id)} />
          <Button size="small" icon={<CloseOutlined />} onClick={handlers.onCancel} />
        </Space>
      ) : (
        <Space>
          <span>{c.name}</span>
          <Button
            size="small" type="text" icon={<EditOutlined />}
            onClick={() => handlers.onEdit(c.id, c.name)}
          />
          <Button
            size="small" type="text" icon={<PlusOutlined />}
            onClick={() => handlers.onAddChild(c.id)}
            title="Add child"
          />
          <Popconfirm
            title="Delete this category?"
            description="All child categories will also be removed."
            onConfirm={() => handlers.onDelete(c.id)}
            okText="Delete" okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    children: c.children.length > 0
      ? toTreeData(c.children, editingId, editingName, handlers)
      : undefined,
  }));
}

export default function CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const [newRootName, setNewRootName] = useState('');
  const [addingRoot, setAddingRoot] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setCategories(await api.fetchCategories());
    } catch {
      setError('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function startEdit(id: number, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  async function saveEdit(id: number) {
    if (!editingName.trim()) { message.warning('Name cannot be empty'); return; }
    await api.renameCategory(id, editingName.trim());
    message.success('Category renamed');
    setEditingId(null);
    setEditingName('');
    fetchCategories();
  }

  function cancelEdit() { setEditingId(null); setEditingName(''); }

  async function handleDelete(id: number) {
    await api.deleteCategory(id);
    message.success('Category deleted');
    fetchCategories();
  }

  async function handleAddChild(parentId: number) {
    const name = prompt('New category name:');
    if (!name?.trim()) return;
    await api.createCategory(name.trim(), parentId);
    message.success('Category added');
    fetchCategories();
  }

  async function handleAddRoot() {
    if (!newRootName.trim()) { message.warning('Name cannot be empty'); return; }
    await api.createCategory(newRootName.trim(), null);
    message.success('Root category added');
    setNewRootName('');
    setAddingRoot(false);
    fetchCategories();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message={error} />;

  const treeData = toTreeData(categories, editingId, editingName, {
    onEdit: startEdit,
    onSave: saveEdit,
    onCancel: cancelEdit,
    onDelete: handleDelete,
    onAddChild: handleAddChild,
  });

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Categories</Title>
        <Button icon={<PlusOutlined />} onClick={() => setAddingRoot(true)}>
          Add root category
        </Button>
      </div>

      {addingRoot && (
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="New category name"
            value={newRootName}
            onChange={(e) => setNewRootName(e.target.value)}
            onPressEnter={handleAddRoot}
            style={{ width: 220 }}
            autoFocus
          />
          <Button type="primary" onClick={handleAddRoot}>Add</Button>
          <Button onClick={() => { setAddingRoot(false); setNewRootName(''); }}>Cancel</Button>
        </Space>
      )}

      <Card size="small">
        {categories.length === 0 ? (
          <Typography.Text type="secondary">No categories yet.</Typography.Text>
        ) : (
          <Tree treeData={treeData} defaultExpandAll blockNode selectable={false} />
        )}
      </Card>
    </div>
  );
}
