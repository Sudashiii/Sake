<script lang="ts">
	import styles from './ShelfRuleGroupHeader.module.scss';
	import type { RuleConnector } from '$lib/types/Library/ShelfRule';

	interface Props {
		connector: RuleConnector;
		conditionCount: number;
		isRoot?: boolean;
		onToggleConnector: () => void;
		onAddCondition: () => void;
		onAddGroup: () => void;
		onRemove?: () => void;
	}

	let {
		connector,
		conditionCount,
		isRoot = false,
		onToggleConnector,
		onAddCondition,
		onAddGroup,
		onRemove
	}: Props = $props();

	const connectorToneClass = $derived(connector === 'AND' ? styles.connectorAnd : styles.connectorOr);
	const connectorBackgroundClass = $derived(connector === 'AND' ? styles.connectorAndBg : styles.connectorOrBg);
</script>

<div class={styles.root}>
	<button type="button" class={`${styles.connectorToggle} ${connectorToneClass} ${connectorBackgroundClass}`} onclick={onToggleConnector}>
		{connector}
	</button>
	<span class={styles.hint}>{connector === 'AND' ? 'all must match' : 'any can match'}</span>
	<div class={styles.spacer}></div>
	<span class={styles.count}>{conditionCount}</span>
	<button type="button" class={styles.actionButton} title="Add condition" onclick={onAddCondition}>+ Condition</button>
	<button type="button" class={styles.actionButton} title="Add group" onclick={onAddGroup}>+ Group</button>
	{#if !isRoot && onRemove}
		<button type="button" class={styles.removeButton} title="Remove group" onclick={onRemove}>✕</button>
	{/if}
</div>
