<script lang="ts">
	import SearchIcon from '$lib/assets/icons/SearchIcon.svelte';
	import styles from './SearchBar.module.scss';

	interface Props {
		title?: string;
		placeholder?: string;
		disabled?: boolean;
		onSearch: () => void;
		onKeydown: (event: KeyboardEvent) => void;
	}

	let {
		title = $bindable(''),
		placeholder = 'Search by title, author, or ISBN...',
		disabled = false,
		onSearch,
		onKeydown
	}: Props = $props();
</script>

<div class={styles.root}>
	<SearchIcon class="search-icon" size={20} decorative={true} />
	<input type="text" {placeholder} bind:value={title} onkeydown={onKeydown} />
	<button class="search-btn" onclick={onSearch} disabled={disabled}>Search</button>
</div>
