<script lang="ts">
	import Trash2Icon from '$lib/assets/icons/Trash2Icon.svelte';
	import styles from './TrashHeader.module.scss';

	interface Props {
		count: number;
		emptyingAll?: boolean;
		disabled?: boolean;
		onEmpty: () => void;
	}

	let { count, emptyingAll = false, disabled = false, onEmpty }: Props = $props();
</script>

<header class={styles.root}>
	<div>
		<h2>Trash</h2>
		<p>{count} item{count === 1 ? '' : 's'} in trash. Items are permanently deleted after 30 days.</p>
	</div>
	{#if count > 0}
		<button class="empty-trash-btn" type="button" onclick={onEmpty} disabled={disabled}>
			<Trash2Icon size={14} decorative={true} />
			<span>{emptyingAll ? 'Emptying...' : 'Empty Trash'}</span>
		</button>
	{/if}
</header>
