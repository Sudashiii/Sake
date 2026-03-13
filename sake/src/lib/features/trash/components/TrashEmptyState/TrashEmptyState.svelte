<script lang="ts">
	import Trash2Icon from '$lib/assets/icons/Trash2Icon.svelte';
	import styles from './TrashEmptyState.module.scss';
</script>

<div class={styles.root}>
	<div class="empty-icon" aria-hidden="true">
		<Trash2Icon size={28} decorative={true} />
	</div>
	<h3>Trash is empty</h3>
	<p>Items you delete will appear here before being permanently removed.</p>
</div>
