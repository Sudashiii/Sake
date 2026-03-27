export const RULE_FIELDS = [
	'title',
	'author',
	'series',
	'format',
	'language',
	'status',
	'seriesIndex',
	'rating',
	'readingProgress',
	'year',
	'pages'
] as const;

export const RULE_OPERATORS = [
	'equals',
	'not_equals',
	'contains',
	'not_contains',
	'gt',
	'lt',
	'gte',
	'lte'
] as const;

export const RULE_CONNECTORS = ['AND', 'OR'] as const;

export type RuleField = (typeof RULE_FIELDS)[number];
export type RuleOperator = (typeof RULE_OPERATORS)[number];
export type RuleConnector = (typeof RULE_CONNECTORS)[number];

export const RULE_FIELD_OPTIONS: readonly { value: RuleField; label: string; type: 'string' | 'number' }[] = [
	{ value: 'title', label: 'Title', type: 'string' },
	{ value: 'author', label: 'Author', type: 'string' },
	{ value: 'series', label: 'Series', type: 'string' },
	{ value: 'format', label: 'Format', type: 'string' },
	{ value: 'language', label: 'Language', type: 'string' },
	{ value: 'status', label: 'Status', type: 'string' },
	{ value: 'seriesIndex', label: 'Series Index', type: 'number' },
	{ value: 'rating', label: 'Rating', type: 'number' },
	{ value: 'readingProgress', label: 'Progress', type: 'number' },
	{ value: 'year', label: 'Year', type: 'number' },
	{ value: 'pages', label: 'Pages', type: 'number' }
] as const;

export interface ShelfCondition {
	id: string;
	type: 'condition';
	field: RuleField;
	operator: RuleOperator;
	value: string;
}

export interface RuleGroup {
	id: string;
	type: 'group';
	connector: RuleConnector;
	children: RuleNode[];
}

export type RuleNode = ShelfCondition | RuleGroup;

const RULE_FIELD_SET = new Set<string>(RULE_FIELDS);
const RULE_OPERATOR_SET = new Set<string>(RULE_OPERATORS);
const RULE_CONNECTOR_SET = new Set<string>(RULE_CONNECTORS);

export function createEmptyRuleGroup(id = 'root', connector: RuleConnector = 'AND'): RuleGroup {
	return {
		id,
		type: 'group',
		connector,
		children: []
	};
}

export function countRuleConditions(node: RuleNode): number {
	if (node.type === 'condition') {
		return 1;
	}
	return node.children.reduce((sum, child) => sum + countRuleConditions(child), 0);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isShelfCondition(value: unknown): value is ShelfCondition {
	if (!isObject(value)) {
		return false;
	}

	return (
		value.type === 'condition' &&
		typeof value.id === 'string' &&
		value.id.length > 0 &&
		typeof value.field === 'string' &&
		RULE_FIELD_SET.has(value.field) &&
		typeof value.operator === 'string' &&
		RULE_OPERATOR_SET.has(value.operator) &&
		typeof value.value === 'string'
	);
}

function isRuleGroupInternal(value: unknown, depth: number): value is RuleGroup {
	if (!isObject(value)) {
		return false;
	}

	if (depth > 10) {
		return false;
	}

	if (
		value.type !== 'group' ||
		typeof value.id !== 'string' ||
		value.id.length === 0 ||
		typeof value.connector !== 'string' ||
		!RULE_CONNECTOR_SET.has(value.connector) ||
		!Array.isArray(value.children)
	) {
		return false;
	}

	return value.children.every((child) => isShelfCondition(child) || isRuleGroupInternal(child, depth + 1));
}

export function isRuleGroup(value: unknown): value is RuleGroup {
	return isRuleGroupInternal(value, 0);
}

export function parseRuleGroup(value: unknown): { ok: true; value: RuleGroup } | { ok: false; error: string } {
	if (!isRuleGroup(value)) {
		return { ok: false, error: 'ruleGroup is invalid' };
	}

	return { ok: true, value };
}
