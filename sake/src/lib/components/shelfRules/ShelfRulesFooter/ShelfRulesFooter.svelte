<script lang="ts">
	import styles from './ShelfRulesFooter.module.scss';

	interface Props {
		totalConditions: number;
		pending?: boolean;
		onClose: () => void;
		onSave: () => void | Promise<void>;
	}

	let { totalConditions, pending = false, onClose, onSave }: Props = $props();
</script>

<footer class={styles.root}>
	<p class={styles.count}>
		{#if totalConditions > 0}
			{totalConditions} condition{totalConditions === 1 ? '' : 's'}
		{:else}
			Manual assignment only
		{/if}
	</p>
	<div class={styles.actions}>
		<button type="button" class={`${styles.button} ${styles.cancelButton}`} onclick={onClose} disabled={pending}>Cancel</button>
		<button type="button" class={`${styles.button} ${styles.saveButton}`} onclick={() => void onSave()} disabled={pending}>
			{pending ? 'Saving...' : 'Save Rules'}
		</button>
	</div>
</footer>
