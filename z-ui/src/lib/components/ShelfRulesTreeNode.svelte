<script lang="ts">
	import ShelfRulesTreeNode from '$lib/components/ShelfRulesTreeNode.svelte';
	import type {
		RuleConnector,
		RuleField,
		RuleGroup,
		RuleNode,
		RuleOperator,
		ShelfCondition
	} from '$lib/types/Library/ShelfRule';
	import { countRuleConditions } from '$lib/types/Library/ShelfRule';

	interface Props {
		group: RuleGroup;
		depth?: number;
		isRoot?: boolean;
		onChange: (updated: RuleGroup) => void;
		onRemove?: () => void;
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
		{ value: 'pages', label: 'Pages', type: 'number' }
	];

	const STRING_OPERATORS: { value: RuleOperator; label: string }[] = [
		{ value: 'equals', label: 'equals' },
		{ value: 'not_equals', label: '≠' },
		{ value: 'contains', label: 'contains' },
		{ value: 'not_contains', label: '!contains' }
	];

	const NUMBER_OPERATORS: { value: RuleOperator; label: string }[] = [
		{ value: 'equals', label: '=' },
		{ value: 'not_equals', label: '≠' },
		{ value: 'gt', label: '>' },
		{ value: 'lt', label: '<' },
		{ value: 'gte', label: '≥' },
		{ value: 'lte', label: '≤' }
	];

	let { group, depth = 0, isRoot = false, onChange, onRemove }: Props = $props();

	function uid(): string {
		return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	}

	function newCondition(): ShelfCondition {
		return {
			id: `cond-${uid()}`,
			type: 'condition',
			field: 'status',
			operator: 'equals',
			value: ''
		};
	}

	function newGroup(connector: RuleConnector = 'AND'): RuleGroup {
		return {
			id: `grp-${uid()}`,
			type: 'group',
			connector,
			children: []
		};
	}

	function getFieldType(field: RuleField): 'string' | 'number' {
		const option = FIELD_OPTIONS.find((item) => item.value === field);
		return option?.type ?? 'string';
	}

	function getOperatorsForField(field: RuleField): { value: RuleOperator; label: string }[] {
		return getFieldType(field) === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
	}

	function getPlaceholder(field: RuleField): string {
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

	function toggleConnector(): void {
		onChange({
			...group,
			connector: group.connector === 'AND' ? 'OR' : 'AND'
		});
	}

	function addCondition(): void {
		onChange({
			...group,
			children: [...group.children, newCondition()]
		});
	}

	function addSubGroup(): void {
		onChange({
			...group,
			children: [...group.children, newGroup(group.connector === 'AND' ? 'OR' : 'AND')]
		});
	}

	function updateChild(childId: string, updater: (node: RuleNode) => RuleNode | null): void {
		const updatedChildren = group.children
			.map((child) => (child.id === childId ? updater(child) : child))
			.filter((child): child is RuleNode => child !== null);

		onChange({
			...group,
			children: updatedChildren
		});
	}

	function connectorColor(): string {
		return group.connector === 'AND' ? 'connector-and' : 'connector-or';
	}

	function connectorBackground(): string {
		return group.connector === 'AND' ? 'connector-and-bg' : 'connector-or-bg';
	}

	function treeLineClass(): string {
		return group.connector === 'AND' ? 'tree-line-and' : 'tree-line-or';
	}

	let conditionCount = $derived(countRuleConditions(group));
</script>

<div class:node-shell={!isRoot} class:connector-and-bg={!isRoot && group.connector === 'AND'} class:connector-or-bg={!isRoot && group.connector === 'OR'}>
	<div class="group-header">
		<button type="button" class={`connector-toggle ${connectorColor()} ${connectorBackground()}`} onclick={toggleConnector}>
			{group.connector}
		</button>
		<span class="group-hint">{group.connector === 'AND' ? 'all must match' : 'any can match'}</span>
		<div class="group-spacer"></div>
		<span class="group-count">{conditionCount}</span>
		<button type="button" class="group-action" title="Add condition" onclick={addCondition}>+ Condition</button>
		<button type="button" class="group-action" title="Add group" onclick={addSubGroup}>+ Group</button>
		{#if !isRoot && onRemove}
			<button type="button" class="group-remove" title="Remove group" onclick={onRemove}>✕</button>
		{/if}
	</div>

	{#if group.children.length === 0}
		<div class="group-empty">Empty group - add a condition or sub-group</div>
	{:else}
		<div class={`group-children ${!isRoot ? treeLineClass() : ''}`}>
			{#each group.children as child, index (child.id)}
				{#if index > 0}
					<div class="connector-divider">
						<span class={`connector-label ${connectorColor()}`}>{group.connector}</span>
						<div class="connector-line"></div>
					</div>
				{/if}

				{#if child.type === 'condition'}
					<div class="condition-row">
						<div class="condition-controls">
							<div class="select-wrap">
								<select
									value={child.field}
									onchange={(event) => {
										const nextField = (event.currentTarget as HTMLSelectElement).value as RuleField;
										const nextType = getFieldType(nextField);
										const previousType = getFieldType(child.field);

										updateChild(child.id, (node) => {
											if (node.type !== 'condition') {
												return node;
											}
											return {
												...node,
												field: nextField,
												operator: nextType !== previousType ? 'equals' : node.operator
											};
										});
									}}
								>
									{#each FIELD_OPTIONS as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>

							<div class="select-wrap operator">
								<select
									value={child.operator}
									onchange={(event) => {
										const nextOperator = (event.currentTarget as HTMLSelectElement).value as RuleOperator;
										updateChild(child.id, (node) => {
											if (node.type !== 'condition') {
												return node;
											}
											return {
												...node,
												operator: nextOperator
											};
										});
									}}
								>
									{#each getOperatorsForField(child.field) as operator}
										<option value={operator.value}>{operator.label}</option>
									{/each}
								</select>
							</div>

							<input
								type={getFieldType(child.field) === 'number' ? 'number' : 'text'}
								value={child.value}
								placeholder={getPlaceholder(child.field)}
								oninput={(event) => {
									const nextValue = (event.currentTarget as HTMLInputElement).value;
									updateChild(child.id, (node) => {
										if (node.type !== 'condition') {
											return node;
										}
										return {
											...node,
											value: nextValue
										};
									});
								}}
							/>
						</div>
						<button type="button" class="condition-remove" onclick={() => updateChild(child.id, () => null)}>✕</button>
					</div>
				{:else}
					<ShelfRulesTreeNode
						group={child}
						depth={depth + 1}
						isRoot={false}
						onChange={(updated: RuleGroup) => updateChild(child.id, () => updated)}
						onRemove={() => updateChild(child.id, () => null)}
					/>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.node-shell {
		border-radius: 0.75rem;
		border: 1px solid color-mix(in oklab, var(--color-border), transparent 10%);
		padding: 0.75rem;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.connector-toggle {
		padding: 0.25rem 0.625rem;
		border-radius: 0.375rem;
		border: 1px solid color-mix(in oklab, var(--color-border), transparent 15%);
		font-size: 0.6875rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.connector-and {
		color: #60a5fa;
	}

	.connector-or {
		color: #c9a962;
	}

	.connector-and-bg {
		background: rgba(96, 165, 250, 0.08);
	}

	.connector-or-bg {
		background: rgba(201, 169, 98, 0.08);
	}

	.group-hint {
		font-size: 0.625rem;
		color: color-mix(in oklab, var(--color-text-muted), transparent 35%);
	}

	.group-spacer {
		flex: 1;
	}

	.group-count {
		font-size: 0.625rem;
		color: color-mix(in oklab, var(--color-text-muted), transparent 20%);
		min-width: 1.3rem;
		text-align: right;
	}

	.group-action,
	.group-remove,
	.condition-remove {
		border: none;
		background: transparent;
		color: color-mix(in oklab, var(--color-text-primary), transparent 40%);
		font-size: 0.625rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.group-action:hover,
	.group-remove:hover,
	.condition-remove:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-text-primary);
	}

	.group-empty {
		padding: 0.8rem 0.4rem;
		text-align: center;
		font-size: 0.6875rem;
		color: color-mix(in oklab, var(--color-text-muted), transparent 25%);
	}

	.group-children {
		display: grid;
		gap: 0.5rem;
	}

	.tree-line-and,
	.tree-line-or {
		margin-left: 0.65rem;
		padding-left: 0.65rem;
		border-left-width: 2px;
		border-left-style: solid;
	}

	.tree-line-and {
		border-left-color: rgba(96, 165, 250, 0.25);
	}

	.tree-line-or {
		border-left-color: rgba(201, 169, 98, 0.25);
	}

	.connector-divider {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.125rem 0;
	}

	.connector-label {
		font-size: 0.5625rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.connector-line {
		flex: 1;
		height: 1px;
		background: color-mix(in oklab, var(--color-border), transparent 18%);
	}

	.condition-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.condition-controls {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex: 1;
		min-width: 0;
	}

	.select-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.select-wrap select,
	.condition-controls input {
		background: color-mix(in oklab, var(--color-surface), white 6%);
		border: 1px solid color-mix(in oklab, var(--color-border), transparent 20%);
		border-radius: 0.5rem;
		padding: 0.375rem 0.625rem;
		font-size: 0.75rem;
		color: var(--color-text-primary);
		outline: none;
	}

	.select-wrap.operator select {
		min-width: 4.1rem;
	}

	.condition-controls input {
		flex: 1;
		min-width: 0;
	}

	.condition-remove {
		opacity: 0;
	}

	.condition-row:hover .condition-remove {
		opacity: 1;
	}

	.select-wrap select:focus,
	.condition-controls input:focus {
		border-color: color-mix(in oklab, var(--color-primary), transparent 30%);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary), transparent 80%);
	}
</style>
