<script lang="ts">
	import BookOpenIcon from '$lib/assets/icons/BookOpenIcon.svelte';
	import SearchIcon from '$lib/assets/icons/SearchIcon.svelte';
	import styles from './LibraryEmptyState.module.scss';

	interface Props {
		title: string;
		description: string;
		showSearchLink?: boolean;
	}

	let { title, description, showSearchLink = false }: Props = $props();
</script>

<div class={styles.root}>
	<div class="empty-icon"><BookOpenIcon size={56} decorative={true} strokeWidth={1.5} /></div>
	<h3>{title}</h3>
	<p>{description}</p>
	{#if showSearchLink}
		<a href="/search" class="link-btn"><SearchIcon size={18} decorative={true} />Go to Search</a>
	{/if}
</div>
