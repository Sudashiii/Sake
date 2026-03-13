<script lang="ts">
	import ArchiveBoxIcon from '$lib/assets/icons/ArchiveBoxIcon.svelte';
	import styles from './ArchivedEmptyState.module.scss';
</script>

<div class={styles.root}>
	<div class="empty-icon" aria-hidden="true">
		<ArchiveBoxIcon size={28} decorative={true} />
	</div>
	<h3>No archived books</h3>
	<p>Books you archive will appear here. Archive books to hide them from your main library without deleting them.</p>
</div>
