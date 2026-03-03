import React, { useState } from 'react';
import { X, Plus, Trash2, ChevronDown, Filter, FolderPlus, GripVertical } from 'lucide-react';
import type {
  Shelf,
  RuleGroup,
  RuleNode,
  ShelfCondition,
  RuleField,
  RuleOperator,
  RuleConnector,
} from '../lib/mock-data';
import { countConditions } from '../lib/mock-data';

interface ShelfRulesModalProps {
  shelf: Shelf;
  onClose: () => void;
  onSave: (ruleGroup: RuleGroup) => void;
}

const FIELD_OPTIONS: { value: RuleField; label: string; type: 'string' | 'number' }[] = [
  { value: 'title', label: 'Title', type: 'string' },
  { value: 'author', label: 'Author', type: 'string' },
  { value: 'format', label: 'Format', type: 'string' },
  { value: 'language', label: 'Language', type: 'string' },
  { value: 'status', label: 'Status', type: 'string' },
  { value: 'rating', label: 'Rating', type: 'number' },
  { value: 'readingProgress', label: 'Progress', type: 'number' },
  { value: 'year', label: 'Year', type: 'number' },
  { value: 'pages', label: 'Pages', type: 'number' },
];

const STRING_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: '≠' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: '!contains' },
];

const NUMBER_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
];

function getFieldType(field: RuleField): 'string' | 'number' {
  return FIELD_OPTIONS.find((f) => f.value === field)?.type ?? 'string';
}

function getOperatorsForField(field: RuleField) {
  return getFieldType(field) === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
}

function getPlaceholder(field: RuleField): string {
  switch (field) {
    case 'status': return 'unread, reading, read';
    case 'format': return 'EPUB, PDF, MOBI';
    case 'rating': return '0–5';
    case 'readingProgress': return '0–100';
    case 'year': return 'e.g. 1984';
    case 'pages': return 'e.g. 300';
    default: return 'Value...';
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newCondition(): ShelfCondition {
  return { id: `cond-${uid()}`, type: 'condition', field: 'status', operator: 'equals', value: '' };
}

function newGroup(connector: RuleConnector = 'AND'): RuleGroup {
  return { id: `grp-${uid()}`, type: 'group', connector, children: [] };
}

/** Deep-clone and apply an update to a node by id within a tree */
function updateNodeInTree(root: RuleGroup, nodeId: string, updater: (node: RuleNode) => RuleNode | null): RuleGroup {
  if (root.id === nodeId) {
    const result = updater(root);
    return result?.type === 'group' ? result : root;
  }
  return {
    ...root,
    children: root.children
      .map((child) => {
        if (child.id === nodeId) {
          return updater(child);
        }
        if (child.type === 'group') {
          return updateNodeInTree(child, nodeId, updater);
        }
        return child;
      })
      .filter(Boolean) as RuleNode[],
  };
}

/** Add a child to a specific group */
function addChildToGroup(root: RuleGroup, groupId: string, child: RuleNode): RuleGroup {
  if (root.id === groupId) {
    return { ...root, children: [...root.children, child] };
  }
  return {
    ...root,
    children: root.children.map((c) =>
      c.type === 'group' ? addChildToGroup(c, groupId, child) : c
    ),
  };
}

// ─── Condition Row ───────────────────────────────────────────────
function ConditionRow({
  condition,
  onUpdate,
  onRemove,
  isOnly,
}: {
  condition: ShelfCondition;
  onUpdate: (updates: Partial<ShelfCondition>) => void;
  onRemove: () => void;
  isOnly: boolean;
}) {
  const operators = getOperatorsForField(condition.field);
  return (
    <div className="flex items-center gap-1.5 group/cond">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {/* Field */}
        <div className="relative shrink-0">
          <select
            value={condition.field}
            onChange={(e) => {
              const newField = e.target.value as RuleField;
              const newType = getFieldType(newField);
              const oldType = getFieldType(condition.field);
              onUpdate({
                field: newField,
                ...(newType !== oldType ? { operator: 'equals' as RuleOperator } : {}),
              });
            }}
            className="appearance-none bg-input-background border border-border rounded-lg px-2.5 py-1.5 pr-7 text-xs text-foreground cursor-pointer outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Operator */}
        <div className="relative shrink-0">
          <select
            value={condition.operator}
            onChange={(e) => onUpdate({ operator: e.target.value as RuleOperator })}
            className="appearance-none bg-input-background border border-border rounded-lg px-2.5 py-1.5 pr-7 text-xs text-foreground cursor-pointer outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          >
            {operators.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Value */}
        <input
          type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
          value={condition.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={getPlaceholder(condition.field)}
          className="flex-1 min-w-0 bg-input-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
        />
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0 opacity-0 group-hover/cond:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Group Node (recursive) ─────────────────────────────────────
function GroupNode({
  group,
  depth,
  onChange,
  onRemove,
  isRoot,
}: {
  group: RuleGroup;
  depth: number;
  onChange: (updated: RuleGroup) => void;
  onRemove?: () => void;
  isRoot: boolean;
}) {
  const condCount = countConditions(group);
  const connectorColor = group.connector === 'AND' ? 'text-[#60a5fa]' : 'text-[#c9a962]';
  const connectorBg = group.connector === 'AND' ? 'bg-[#60a5fa]/8 border-[#60a5fa]/20' : 'bg-[#c9a962]/8 border-[#c9a962]/20';
  const treeLine = group.connector === 'AND' ? 'border-[#60a5fa]/25' : 'border-[#c9a962]/25';

  const toggleConnector = () => {
    onChange({ ...group, connector: group.connector === 'AND' ? 'OR' : 'AND' });
  };

  const addCondition = () => {
    onChange({ ...group, children: [...group.children, newCondition()] });
  };

  const addSubGroup = () => {
    const subConnector = group.connector === 'AND' ? 'OR' : 'AND';
    onChange({ ...group, children: [...group.children, newGroup(subConnector)] });
  };

  const updateChild = (childId: string, updater: (node: RuleNode) => RuleNode | null) => {
    const updated = group.children
      .map((c) => {
        if (c.id === childId) return updater(c);
        return c;
      })
      .filter(Boolean) as RuleNode[];
    onChange({ ...group, children: updated });
  };

  return (
    <div className={`${!isRoot ? `rounded-xl border ${connectorBg} p-3` : ''}`}>
      {/* Group header */}
      <div className="flex items-center gap-2 mb-2">
        {/* Connector toggle */}
        <button
          onClick={toggleConnector}
          className={`px-2.5 py-1 rounded-md text-[11px] tracking-wide uppercase transition-colors cursor-pointer border ${connectorBg} ${connectorColor}`}
        >
          {group.connector}
        </button>

        <span className="text-[10px] text-muted-foreground/60">
          {group.connector === 'AND' ? 'all must match' : 'any can match'}
        </span>

        <div className="flex-1" />

        {/* Group actions */}
        <button
          onClick={addCondition}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          title="Add condition"
        >
          <Plus className="w-3 h-3" />
          Condition
        </button>
        <button
          onClick={addSubGroup}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          title="Add sub-group"
        >
          <FolderPlus className="w-3 h-3" />
          Group
        </button>
        {!isRoot && onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            title="Remove group"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Children */}
      {group.children.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-[11px] text-muted-foreground/50">
            Empty group — add a condition or sub-group
          </p>
        </div>
      ) : (
        <div className={`relative ${!isRoot ? 'ml-3 pl-3 border-l-2 ' + treeLine : ''}`}>
          <div className="space-y-2">
            {group.children.map((child, index) => (
              <div key={child.id}>
                {/* Connector label between siblings */}
                {index > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <span className={`text-[9px] tracking-widest uppercase ${connectorColor}`}>
                      {group.connector}
                    </span>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                )}

                {child.type === 'condition' ? (
                  <ConditionRow
                    condition={child}
                    isOnly={group.children.length === 1}
                    onUpdate={(updates) =>
                      updateChild(child.id, (c) => ({ ...c, ...updates } as ShelfCondition))
                    }
                    onRemove={() => updateChild(child.id, () => null)}
                  />
                ) : (
                  <GroupNode
                    group={child}
                    depth={depth + 1}
                    isRoot={false}
                    onChange={(updated) =>
                      updateChild(child.id, () => updated)
                    }
                    onRemove={() => updateChild(child.id, () => null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────
export function ShelfRulesModal({ shelf, onClose, onSave }: ShelfRulesModalProps) {
  const [ruleGroup, setRuleGroup] = useState<RuleGroup>(
    JSON.parse(JSON.stringify(shelf.ruleGroup))
  );

  const totalConditions = countConditions(ruleGroup);

  const handleSave = () => {
    // Strip conditions with empty values
    function cleanGroup(g: RuleGroup): RuleGroup {
      return {
        ...g,
        children: g.children
          .map((child) => {
            if (child.type === 'condition') {
              return child.value.trim() ? child : null;
            }
            const cleaned = cleanGroup(child);
            // Remove empty groups
            return cleaned.children.length > 0 ? cleaned : null;
          })
          .filter(Boolean) as RuleNode[],
      };
    }
    onSave(cleanGroup(ruleGroup));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Filter className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2>Shelf Rules</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {shelf.icon} {shelf.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Build a rule tree to automatically include books on this shelf. Groups can be nested
              to create complex conditions like <span className="text-foreground/80">(A AND B) OR (C AND D)</span>.
              Manually assigned books always appear regardless of rules.
            </p>
          </div>

          {/* The rule tree */}
          {ruleGroup.children.length === 0 ? (
            <div className="text-center py-8">
              <Filter className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No rules defined</p>
              <p className="text-xs text-muted-foreground/70 mb-4">
                Add conditions or groups to automatically include matching books.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setRuleGroup({ ...ruleGroup, children: [newCondition()] })}
                  className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Condition
                </button>
                <button
                  onClick={() => setRuleGroup({ ...ruleGroup, children: [newGroup(ruleGroup.connector === 'AND' ? 'OR' : 'AND')] })}
                  className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  Add Group
                </button>
              </div>
            </div>
          ) : (
            <GroupNode
              group={ruleGroup}
              depth={0}
              isRoot={true}
              onChange={setRuleGroup}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            {totalConditions > 0
              ? `${totalConditions} condition${totalConditions !== 1 ? 's' : ''}`
              : 'Manual assignment only'
            }
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
