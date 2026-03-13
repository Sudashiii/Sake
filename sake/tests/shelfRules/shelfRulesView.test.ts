import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRuleCondition, createRuleGroup, getFieldType, getOperatorsForField, getRulePlaceholder } from '$lib/components/shelfRules/shelfRulesView';

describe('shelfRulesView', () => {
	test('creates default rule condition', () => {
		const condition = createRuleCondition();

		assert.equal(condition.type, 'condition');
		assert.equal(condition.field, 'status');
		assert.equal(condition.operator, 'equals');
		assert.equal(condition.value, '');
		assert.equal(condition.id.startsWith('cond-'), true);
	});

	test('creates default rule groups', () => {
		const group = createRuleGroup('OR');

		assert.equal(group.type, 'group');
		assert.equal(group.connector, 'OR');
		assert.deepEqual(group.children, []);
		assert.equal(group.id.startsWith('grp-'), true);
	});

	test('returns numeric field operators for numeric fields', () => {
		assert.equal(getFieldType('pages'), 'number');
		assert.deepEqual(
			getOperatorsForField('pages').map((operator) => operator.value),
			['equals', 'not_equals', 'gt', 'lt', 'gte', 'lte']
		);
	});

	test('returns string placeholders for known fields', () => {
		assert.equal(getRulePlaceholder('status'), 'unread, reading, read');
		assert.equal(getRulePlaceholder('pages'), 'e.g. 300');
	});
});
