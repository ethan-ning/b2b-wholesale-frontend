import { Card, Checkbox, Space, Tag, Tooltip, Typography } from 'antd';
import type { Category } from '../../api/types';

const { Text } = Typography;

export type FlatCategory = { id: number; name: string; parentId: number | null; depth: number };

/** The tree, flattened for a checkbox list. Depth is kept so the nesting still reads. */
export function flattenCategories(cats: Category[], depth = 0): FlatCategory[] {
  return cats.flatMap((c) => [
    { id: c.id, name: c.name, parentId: c.parentId, depth },
    ...flattenCategories(c.children, depth + 1),
  ]);
}

interface Props {
  categories: FlatCategory[];
  /** Only what someone actually ticked — see the note on implied ancestors below. */
  selectedIds: number[];
  primaryId: number | null;
  onToggle: (categoryId: number, checked: boolean) => void;
  onPrimary: (categoryId: number) => void;
}

/**
 * Which categories a product is filed under.
 *
 * A product filed under "Hub Caps" is a wheel part and a truck accessory, so its ancestors
 * show ticked and locked — unfiling a branch while something beneath it is still filed
 * would say the product is a hub cap but not a wheel part.
 *
 * Shown, not stored. [selectedIds] holds only what someone picked, and only that is sent:
 * the search expands a requested category to its descendants before matching, so a product
 * filed under the leaf already answers a query for the branch. Writing the ancestors too
 * would be a second copy of a fact the tree already holds, and would count the product as
 * filed *directly* under each of them in the category admin's tallies.
 */
export default function CategoryPicker({
  categories, selectedIds, primaryId, onToggle, onPrimary,
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
      style={{ marginBottom: 16 }}
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
    </Card>
  );
}
