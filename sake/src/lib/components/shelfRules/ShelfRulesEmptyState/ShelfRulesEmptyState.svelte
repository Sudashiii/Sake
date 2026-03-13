<script lang="ts">
	import styles from './ShelfRulesEmptyState.module.scss';

	interface Props {
		onAddCondition: () => void;
		onAddGroup: () => void;
	}

	let { onAddCondition, onAddGroup }: Props = $props();
</script>

<div class={styles.root}>
	<p class={styles.title}>No rules defined</p>
	<p class={styles.text}>Add conditions or groups to automatically include matching books.</p>
	<div class={styles.actions}>
		<button type="button" class={styles.actionButton} onclick={onAddCondition}>Add Condition</button>
		<button type="button" class={styles.actionButton} onclick={onAddGroup}>Add Group</button>
	</div>
</div>
