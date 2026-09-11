import { Card, Checkbox, Space, Tag, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { FlatCategory } from './flatCategories';

const { Text } = Typography;

interface Props {
  categories: FlatCategory[];
  /** Only what someone actually ticked — see the note on implied ancestors below. */
  selectedIds: number[];
  primaryId: number | null;
  onToggle: (categoryId: number, checked: boolean) => void;
  onPrimary: (categoryId: number) => void;
  /** Rendered below the list — where the page puts this section's Save button. */
  footer?: ReactNode;
}

/**
 * Which categories a product is filed under. Ancestors show ticked and locked: a hub cap
 * is also a wheel part, and unfiling the branch would deny that.
 *
 * Shown, not stored — [selectedIds] holds only what someone picked. Search expands a
 * category to its descendants before matching, so storing the ancestors too would
 * duplicate a fact the tree already holds and inflate the admin's per-node tallies.
 */
export default function CategoryPicker({
  categories, selectedIds, primaryId, onToggle, onPrimary, footer,
}: Props) {
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));

  function ancestorsOf(categoryId: number): number[] {
    const out: number[] = [];
    let next = parentOf.get(categoryId) ?? null;
    while (next != null) {
      out.push(next);
      next = parentOf.get(next) ?? null;
    }
    return out;
  }

  const impliedIds = new Set(selectedIds.flatMap(ancestorsOf));

  // The primary is which category the product *lives* in, as opposed to which ones it can
  // be found under — it titles the dealer breadcrumb, where only one will fit. With a
  // single category there is nothing to choose, so the control stays out of the way until
  // the product is genuinely cross-filed and the answer stops being obvious.
  const primaryIsAChoice = selectedIds.length > 1;

  return (
    <Card
      title="Categories"
      size="small"
      className="section-card section-card--categories"
      extra={
        primaryIsAChoice ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Filed in {selectedIds.length} — pick which one titles the dealer breadcrumb
          </Text>
        ) : undefined
      }
    >
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        {categories.map((c) => {
          const selected = selectedIds.includes(c.id);
          const implied = impliedIds.has(c.id);
          return (
            <div key={c.id} style={{ paddingLeft: c.depth * 22 }}>
              <Space>
                <Tooltip title={implied ? 'Implied by a sub-category you have selected' : undefined}>
                  <Checkbox
                    checked={selected || implied}
                    disabled={implied}
                    onChange={(e) => onToggle(c.id, e.target.checked)}
                  >
                    {c.name}
                  </Checkbox>
                </Tooltip>
                {selected && primaryIsAChoice && (
                  <Tag
                    color={primaryId === c.id ? 'blue' : 'default'}
                    style={{ cursor: 'pointer', fontSize: 11 }}
                    onClick={() => onPrimary(c.id)}
                  >
                    {primaryId === c.id ? 'Primary' : 'Set primary'}
                  </Tag>
                )}
              </Space>
            </div>
          );
        })}
      </Space>
      {footer}
    </Card>
  );
}
