<script lang="ts">
	import { countRuleConditions, type RuleGroup, type RuleNode } from '$lib/types/Library/ShelfRule';
	import ShelfRuleConditionRow from '../ShelfRuleConditionRow/ShelfRuleConditionRow.svelte';
	import ShelfRuleGroupHeader from '../ShelfRuleGroupHeader/ShelfRuleGroupHeader.svelte';
	import { createRuleCondition, createRuleGroup } from '../shelfRulesView';
	import styles from './ShelfRulesTreeNode.module.scss';
	import ShelfRulesTreeNode from './ShelfRulesTreeNode.svelte';

	interface Props {
		group: RuleGroup;
		isRoot?: boolean;
		onChange: (updated: RuleGroup) => void;
		onRemove?: () => void;
	}

	let { group, isRoot = false, onChange, onRemove }: Props = $props();

	const conditionCount = $derived(countRuleConditions(group));
	const connectorToneClass = $derived(group.connector === 'AND' ? styles.connectorAnd : styles.connectorOr);
	const connectorShellClass = $derived(group.connector === 'AND' ? styles.connectorAndBg : styles.connectorOrBg);
	const treeLineClass = $derived(group.connector === 'AND' ? styles.treeLineAnd : styles.treeLineOr);

	function toggleConnector(): void {
		onChange({
			...group,
			connector: group.connector === 'AND' ? 'OR' : 'AND'
		});
	}

	function addCondition(): void {
		onChange({
			...group,
			children: [...group.children, createRuleCondition()]
		});
	}

	function addSubGroup(): void {
		onChange({
			...group,
			children: [...group.children, createRuleGroup(group.connector === 'AND' ? 'OR' : 'AND')]
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
</script>

<div class={`${!isRoot ? styles.nodeShell : ''} ${!isRoot ? connectorShellClass : ''}`}>
	<ShelfRuleGroupHeader
		connector={group.connector}
		conditionCount={conditionCount}
		isRoot={isRoot}
		onToggleConnector={toggleConnector}
		onAddCondition={addCondition}
		onAddGroup={addSubGroup}
		onRemove={onRemove}
	/>

	{#if group.children.length === 0}
		<div class={styles.emptyGroup}>Empty group - add a condition or sub-group</div>
	{:else}
		<div class={`${styles.groupChildren} ${!isRoot ? treeLineClass : ''}`}>
			{#each group.children as child, index (child.id)}
				{#if index > 0}
					<div class={styles.connectorDivider}>
						<span class={`${styles.connectorLabel} ${connectorToneClass}`}>{group.connector}</span>
						<div class={styles.connectorLine}></div>
					</div>
				{/if}

				{#if child.type === 'condition'}
					<ShelfRuleConditionRow
						condition={child}
						onChange={(updated) => updateChild(child.id, () => updated)}
						onRemove={() => updateChild(child.id, () => null)}
					/>
				{:else}
					<ShelfRulesTreeNode
						group={child}
						isRoot={false}
						onChange={(updated: RuleGroup) => updateChild(child.id, () => updated)}
						onRemove={() => updateChild(child.id, () => null)}
					/>
				{/if}
			{/each}
		</div>
	{/if}
</div>
