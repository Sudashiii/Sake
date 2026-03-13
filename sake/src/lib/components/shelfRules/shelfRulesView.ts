import { RULE_FIELD_OPTIONS, type RuleConnector, type RuleField, type RuleGroup, type RuleOperator, type ShelfCondition } from '$lib/types/Library/ShelfRule';

export const STRING_OPERATORS: { value: RuleOperator; label: string }[] = [
	{ value: 'equals', label: 'equals' },
	{ value: 'not_equals', label: '≠' },
	{ value: 'contains', label: 'contains' },
	{ value: 'not_contains', label: '!contains' }
];

export const NUMBER_OPERATORS: { value: RuleOperator; label: string }[] = [
	{ value: 'equals', label: '=' },
	{ value: 'not_equals', label: '≠' },
	{ value: 'gt', label: '>' },
	{ value: 'lt', label: '<' },
	{ value: 'gte', label: '≥' },
	{ value: 'lte', label: '≤' }
];

function uid(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createRuleCondition(): ShelfCondition {
	return {
		id: `cond-${uid()}`,
		type: 'condition',
		field: 'status',
		operator: 'equals',
		value: ''
	};
}

export function createRuleGroup(connector: RuleConnector = 'AND'): RuleGroup {
	return {
		id: `grp-${uid()}`,
		type: 'group',
		connector,
		children: []
	};
}

export function getFieldType(field: RuleField): 'string' | 'number' {
	const option = RULE_FIELD_OPTIONS.find((item) => item.value === field);
	return option?.type ?? 'string';
}

export function getOperatorsForField(field: RuleField): { value: RuleOperator; label: string }[] {
	return getFieldType(field) === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
}

export function getRulePlaceholder(field: RuleField): string {
	switch (field) {
		case 'status':
			return 'unread, reading, read';
		case 'format':
			return 'epub, pdf, mobi';
		case 'rating':
			return '0-5';
		case 'readingProgress':
			return '0-100';
		case 'year':
			return 'e.g. 1984';
		case 'pages':
			return 'e.g. 300';
		default:
			return 'Value...';
	}
}
