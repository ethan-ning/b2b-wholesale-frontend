import { useEffect, useState, useCallback } from 'react';
import { useIsMounted } from '../../hooks/useIsMounted';
import {
  Typography, Button, Input, Space, Popconfirm, message, Tree, Card, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined,
  FolderFilled, FolderOpenOutlined, TagOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import * as api from '../../api/adminApi';
import PageHeader from '../../components/admin/PageHeader';
import { PageError, PageLoading } from '../../components/PageState';
import type { CategoryNode } from '../../api/types';

const { Text } = Typography;

/** Matches the backend's Category.MAX_DEPTH. */
const MAX_DEPTH = 3;

/**
 * One visual identity per level, so depth reads at a glance instead of being inferred
 * from indentation. Ant's tree indents by a single tab stop, which at three levels is
 * easy to lose track of once nodes carry buttons and tags.
 */
const LEVEL = {
  1: { label: 'Department', accent: '#1677ff', tint: '#f0f7ff', size: 15, weight: 600, icon: <FolderFilled /> },
  2: { label: 'Category', accent: '#52c41a', tint: '#f6ffed', size: 14, weight: 500, icon: <FolderOpenOutlined /> },
  3: { label: 'Sub-category', accent: '#faad14', tint: '#fffbe6', size: 13, weight: 400, icon: <TagOutlined /> },
} as const;

function levelStyle(depth: number) {
  return LEVEL[Math.min(depth, MAX_DEPTH) as 1 | 2 | 3];
}

/** One neutral for every count, at every level. */
const COUNT_TAG = { fontSize: 11, marginInlineEnd: 0, color: '#595959' } as const;

interface Handlers {
  onEdit: (id: number, name: string) => void;
  onSave: (id: number) => void;
  onCancel: () => void;
  onDelete: (id: number) => void;
  onStartAddChild: (parentId: number) => void;
  onConfirmAddChild: (parentId: number) => void;
  onCancelAddChild: () => void;
  onDraftChange: (name: string) => void;
}

interface EditState {
  editingId: number | null;
  editingName: string;
  addingUnder: number | null;
  draftChildName: string;
}

/**
 * What deleting this node will actually do. The API no longer refuses over products — it
 * unfiles them — so the confirmation has to say how many, or the admin is agreeing to
 * something the button did not mention.
 */
function deleteDescription(c: CategoryNode): string {
  if (c.productCount === 0) return 'Nothing is filed under it.';
  const n = c.productCount;
  return `${n} product${n === 1 ? '' : 's'} will be removed from this category. `
    + `${n === 1 ? 'It is' : 'They are'} not deleted — just no longer filed here.`;
}

function toTreeData(cats: CategoryNode[], state: EditState, handlers: Handlers): DataNode[] {
  return cats.map((c) => {
    const level = levelStyle(c.depth);
    const isParent = c.children.length > 0;
    // On a parent the subtree total is the number that means something; its own direct
    // count is worth the space only when it actually holds something.
    const showDirect = !isParent || c.productCount > 0;

    const row = state.editingId === c.id ? (
      <Space>
        <Input
          size="small"
          value={state.editingName}
          onChange={(e) => handlers.onEdit(c.id, e.target.value)}
          style={{ width: 180 }}
          onPressEnter={() => handlers.onSave(c.id)}
          autoFocus
        />
        <Button size="small" icon={<CheckOutlined />} type="primary" onClick={() => handlers.onSave(c.id)} />
        <Button size="small" icon={<CloseOutlined />} onClick={handlers.onCancel} />
      </Space>
    ) : (
      <Space size={6}>
        <span style={{ color: level.accent }}>{level.icon}</span>
        <span style={{ fontSize: level.size, fontWeight: level.weight }}>{c.name}</span>

        {/* Grey at every level. Colour here competes with the level accents for no gain —
            the counts are reference figures, not the thing the eye should land on. */}
        {showDirect && (
          <Tooltip
            title={`${c.productCount} product${c.productCount === 1 ? '' : 's'} filed directly here`}
          >
            <Tag style={COUNT_TAG}>{c.productCount}</Tag>
          </Tooltip>
        )}

        {/* Distinct products, so one filed under both a parent and its child counts once
            — which is why this is not the sum of the children's tags. */}
        {isParent && (
          <Tooltip title="Distinct products in this category and everything beneath it">
            <Tag style={COUNT_TAG}>{c.totalProductCount} in total</Tag>
          </Tooltip>
        )}

        <Button
          size="small" type="text" icon={<EditOutlined />}
          onClick={() => handlers.onEdit(c.id, c.name)}
          title="Rename"
        />

        {c.canAddChild ? (
          <Button
            size="small" type="text" icon={<PlusOutlined />}
            onClick={() => handlers.onStartAddChild(c.id)}
            title="Add sub-category"
          />
        ) : (
          <Tooltip title={`Categories go ${MAX_DEPTH} levels deep at most`}>
            {/* A disabled button swallows hover, so the tooltip needs a wrapper. */}
            <span>
              <Button size="small" type="text" disabled icon={<PlusOutlined />} />
            </span>
          </Tooltip>
        )}

        {c.deletable ? (
          <Popconfirm
            title="Delete this category?"
            description={deleteDescription(c)}
            onConfirm={() => handlers.onDelete(c.id)}
            okText="Delete" okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Delete" />
          </Popconfirm>
        ) : (
          <Tooltip title={`Cannot delete: ${c.blockedReason}`}>
            <span>
              <Button size="small" type="text" danger disabled icon={<DeleteOutlined />} />
            </span>
          </Tooltip>
        )}
      </Space>
    );

    const childNodes = toTreeData(c.children, state, handlers);

    // The new-child field sits where the child will appear, so the level it is being
    // added at is obvious before it exists.
    if (state.addingUnder === c.id) {
      const childLevel = levelStyle(c.depth + 1);
      childNodes.push({
        key: `new-under-${c.id}`,
        title: (
          <Space size={6} style={{ padding: '2px 0' }}>
            <span style={{ color: childLevel.accent }}>{childLevel.icon}</span>
            <Input
              size="small"
              placeholder={`New ${childLevel.label.toLowerCase()} name`}
              value={state.draftChildName}
              onChange={(e) => handlers.onDraftChange(e.target.value)}
              onPressEnter={() => handlers.onConfirmAddChild(c.id)}
              style={{ width: 200 }}
              autoFocus
            />
            <Button
              size="small" type="primary" icon={<CheckOutlined />}
              onClick={() => handlers.onConfirmAddChild(c.id)}
            />
            <Button size="small" icon={<CloseOutlined />} onClick={handlers.onCancelAddChild} />
          </Space>
        ),
      });
    }

    return {
      key: String(c.id),
      title: (
        <div
          style={{
            display: 'inline-block',
            borderLeft: `3px solid ${level.accent}`,
            background: level.tint,
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          {row}
        </div>
      ),
      children: childNodes.length > 0 ? childNodes : undefined,
    };
  });
}

export default function CategoryPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const [addingUnder, setAddingUnder] = useState<number | null>(null);
  const [draftChildName, setDraftChildName] = useState('');

  const [newRootName, setNewRootName] = useState('');
  const [addingRoot, setAddingRoot] = useState(false);

  const mounted = useIsMounted();

  const fetchCategories = useCallback(async () => {
    try {
      const next = await api.fetchCategories();
      if (mounted.current) setCategories(next);
    } catch {
      if (mounted.current) setError('Failed to load categories.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [mounted]);

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

  function startAddChild(parentId: number) {
    setAddingUnder(parentId);
    setDraftChildName('');
  }

  function cancelAddChild() { setAddingUnder(null); setDraftChildName(''); }

  async function confirmAddChild(parentId: number) {
    if (!draftChildName.trim()) { message.warning('Name cannot be empty'); return; }
    await api.createCategory(draftChildName.trim(), parentId);
    message.success('Sub-category added');
    cancelAddChild();
    fetchCategories();
  }

  async function handleAddRoot() {
    if (!newRootName.trim()) { message.warning('Name cannot be empty'); return; }
    await api.createCategory(newRootName.trim(), null);
    message.success('Department added');
    setNewRootName('');
    setAddingRoot(false);
    fetchCategories();
  }

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  const treeData = toTreeData(
    categories,
    { editingId, editingName, addingUnder, draftChildName },
    {
      onEdit: startEdit,
      onSave: saveEdit,
      onCancel: cancelEdit,
      onDelete: handleDelete,
      onStartAddChild: startAddChild,
      onConfirmAddChild: confirmAddChild,
      onCancelAddChild: cancelAddChild,
      onDraftChange: setDraftChildName,
    },
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        title="Categories"
        subtitle="Ours, not the ERP's — how a dealer looks for a part, not how a warehouse files it."
        actions={
          <Button icon={<PlusOutlined />} onClick={() => setAddingRoot(true)}>
            Add department
          </Button>
        }
      />

      {/* Names the levels the colours stand for, and states the cap once rather than only
          on the disabled button an admin has to go looking for. */}
      <Space size={12} style={{ marginBottom: 16 }} wrap>
        {([1, 2, 3] as const).map((d) => (
          <Space key={d} size={4}>
            <span style={{ color: LEVEL[d].accent }}>{LEVEL[d].icon}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Level {d} · {LEVEL[d].label}
            </Text>
          </Space>
        ))}
        <Text type="secondary" style={{ fontSize: 12 }}>— {MAX_DEPTH} levels maximum</Text>
      </Space>

      {addingRoot && (
        <Space style={{ marginBottom: 16, display: 'flex' }}>
          <Input
            placeholder="New department name"
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

      <Card size="small" className="section-card section-card--categories">
        {categories.length === 0 ? (
          <Typography.Text type="secondary">No categories yet.</Typography.Text>
        ) : (
          <Tree
            treeData={treeData}
            defaultExpandAll
            // Keyed on the node ids so a newly added node appears expanded rather than
            // collapsing the tree back to its first-render state.
            key={categories.map((c) => c.id).join(',') + String(addingUnder)}
            blockNode
            selectable={false}
          />
        )}
      </Card>
    </div>
  );
}
