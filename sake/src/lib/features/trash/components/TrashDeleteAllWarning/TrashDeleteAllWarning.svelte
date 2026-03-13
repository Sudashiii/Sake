<script lang="ts">
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import styles from './TrashDeleteAllWarning.module.scss';

	interface Props {
		count: number;
		emptyingAll?: boolean;
		onDeleteAll: () => void;
		onCancel: () => void;
	}

	let { count, emptyingAll = false, onDeleteAll, onCancel }: Props = $props();
</script>

<div class={styles.root}>
	<div class="warning-icon" aria-hidden="true">
		<AlertCircleIcon size={18} decorative={true} />
	</div>
	<div class="warning-main">
		<p class="warning-title">Permanently delete all {count} items?</p>
		<p class="warning-subtitle">This action cannot be undone.</p>
		<div class="warning-actions">
			<button class="warning-delete" type="button" onclick={onDeleteAll} disabled={emptyingAll}>
				{emptyingAll ? 'Deleting...' : 'Delete All'}
			</button>
			<button class="warning-cancel" type="button" onclick={onCancel} disabled={emptyingAll}>Cancel</button>
		</div>
	</div>
</div>
