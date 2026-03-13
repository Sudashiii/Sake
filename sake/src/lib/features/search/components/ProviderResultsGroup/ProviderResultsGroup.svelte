<script lang="ts">
	import ChevronDownIcon from '$lib/assets/icons/ChevronDownIcon.svelte';
	import BookCard from '$lib/components/BookCard/BookCard.svelte';
	import { providerLabel } from '$lib/features/search/searchView';
	import type { SearchProviderId } from '$lib/types/Search/Provider';
	import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
	import styles from './ProviderResultsGroup.module.scss';

	interface Props {
		providerId: SearchProviderId;
		books: SearchResultBook[];
		collapsed?: boolean;
		onToggle: (providerId: SearchProviderId) => void;
		onDownload: (book: SearchResultBook) => void;
		onShare: (book: SearchResultBook) => void;
		onOpenDetails: (book: SearchResultBook) => void;
	}

	let {
		providerId,
		books,
		collapsed = false,
		onToggle,
		onDownload,
		onShare,
		onOpenDetails
	}: Props = $props();

	function getBookCacheKey(book: SearchResultBook): string {
		return `${book.provider}:${book.providerBookId}`;
	}
</script>

<section class={styles.root}>
	<button
		type="button"
		class="provider-group-toggle"
		aria-expanded={!collapsed}
		aria-controls={`provider-group-${providerId}`}
		onclick={() => onToggle(providerId)}
	>
		<h3>{providerLabel(providerId)} ({books.length})</h3>
		<ChevronDownIcon class={`provider-group-chevron ${collapsed ? 'collapsed' : ''}`} size={14} decorative={true} />
	</button>
	{#if !collapsed}
		<div class="book-list" id={`provider-group-${providerId}`}>
			{#each books as book (getBookCacheKey(book))}
				<BookCard
					{book}
					onDownload={book.capabilities.filesAvailable ? onDownload : undefined}
					onShare={book.capabilities.filesAvailable ? onShare : undefined}
					onOpenDetails={onOpenDetails}
				/>
			{/each}
		</div>
	{/if}
</section>
