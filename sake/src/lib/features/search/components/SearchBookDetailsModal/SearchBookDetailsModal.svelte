<script lang="ts">
	import { onMount } from 'svelte';
	import XIcon from '$lib/assets/icons/XIcon.svelte';
	import { extractIsbn } from '$lib/utils/isbn';
	import {
		displayValue,
		formatFileSize,
		providerLabel,
		toGoogleBooksUrl,
		toOpenLibraryUrl
	} from '$lib/features/search/searchView';
	import type { LookupSearchBookMetadataResponse } from '$lib/client/routes/lookupSearchBookMetadata';
	import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
	import styles from './SearchBookDetailsModal.module.scss';

	interface Props {
		book: SearchResultBook;
		metadata?: LookupSearchBookMetadataResponse['metadata'];
		isLoading?: boolean;
		error?: string | null;
		onClose: () => void;
		onRetry: () => void;
		onCopy: (value: string, label: string) => Promise<void>;
		onDownload: (book: SearchResultBook) => void;
		onAddToLibrary: (book: SearchResultBook) => void;
	}

	let {
		book,
		metadata,
		isLoading = false,
		error = null,
		onClose,
		onRetry,
		onCopy,
		onDownload,
		onAddToLibrary
	}: Props = $props();

	let dialogEl = $state<HTMLDivElement | null>(null);
	let closeButtonEl = $state<HTMLButtonElement | null>(null);

	onMount(() => {
		closeButtonEl?.focus();
	});

	const identifier = $derived(metadata?.identifier ?? book.identifier);
	const isbn = $derived(extractIsbn(identifier));
	const googleBooksUrl = $derived(toGoogleBooksUrl(metadata?.googleBooksId));
	const openLibraryUrl = $derived(toOpenLibraryUrl(metadata?.openLibraryKey));
	const amazonAsin = $derived(metadata?.amazonAsin ?? null);

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return;
		}
		event.stopPropagation();
	}
</script>

<div class={styles.root} role="button" tabindex="0" aria-label="Close search result details" onclick={onClose} onkeydown={(event) => event.key === 'Escape' && onClose()}>
	<div class="search-detail-modal-content" role="dialog" aria-modal="true" aria-labelledby="search-detail-heading" tabindex="-1" bind:this={dialogEl} onclick={(event) => event.stopPropagation()} onkeydown={handleKeydown}>
		<div class="search-detail-header">
			<div>
				<h3 id="search-detail-heading">{book.title}</h3>
				<p class="search-detail-author">by {displayValue(book.author)}</p>
				<p class="search-detail-provider">Provider: {providerLabel(book.provider)}</p>
			</div>
			<button type="button" class="search-detail-close-btn" bind:this={closeButtonEl} onclick={onClose} aria-label="Close details">
				<XIcon size={18} decorative={true} />
			</button>
		</div>

		{#if isLoading}
			<div class="search-detail-meta-status">
				<span>Fetching metadata from Google Books and OpenLibrary...</span>
			</div>
		{:else if error}
			<div class="search-detail-meta-status search-detail-meta-status-error">
				<span>{error}</span>
				<button type="button" class="copy-btn" onclick={onRetry}>Retry</button>
			</div>
		{/if}

		<div class="search-detail-grid">
			<div class="search-detail-row"><span class="label">Format</span><span class="value">{displayValue(book.extension).toUpperCase()}</span></div>
			<div class="search-detail-row"><span class="label">Language</span><span class="value">{displayValue(book.language)}</span></div>
			<div class="search-detail-row"><span class="label">Year</span><span class="value">{displayValue(book.year)}</span></div>
			<div class="search-detail-row"><span class="label">Pages</span><span class="value">{displayValue(metadata?.pages ?? book.pages)}</span></div>
			<div class="search-detail-row"><span class="label">Filesize</span><span class="value">{formatFileSize(book.filesize)}</span></div>
			<div class="search-detail-row"><span class="label">Publisher</span><span class="value">{displayValue(metadata?.publisher)}</span></div>
			<div class="search-detail-row"><span class="label">Series</span><span class="value">{displayValue(metadata?.series)}</span></div>
			<div class="search-detail-row"><span class="label">Volume</span><span class="value">{displayValue(metadata?.volume)}</span></div>
			<div class="search-detail-row"><span class="label">Edition</span><span class="value">{displayValue(metadata?.edition)}</span></div>
			<div class="search-detail-row">
				<span class="label">ISBN</span>
				<div class="value with-action">
					<span>{displayValue(isbn)}</span>
					{#if isbn}
						<button type="button" class="copy-btn" onclick={() => void onCopy(isbn, 'ISBN')}>Copy</button>
					{/if}
				</div>
			</div>
			<div class="search-detail-row">
				<span class="label">Identifier</span>
				<div class="value with-action">
					<span>{displayValue(identifier)}</span>
					{#if identifier}
						<button type="button" class="copy-btn" onclick={() => void onCopy(identifier, 'Identifier')}>Copy</button>
					{/if}
				</div>
			</div>
			<div class="search-detail-row">
				<span class="label">Google Books</span>
				<div class="value with-action">
					<span>{displayValue(metadata?.googleBooksId)}</span>
					{#if googleBooksUrl}
						<a class="external-link-btn" href={googleBooksUrl} target="_blank" rel="noopener noreferrer">Open</a>
					{/if}
				</div>
			</div>
			<div class="search-detail-row">
				<span class="label">OpenLibrary</span>
				<div class="value with-action">
					<span>{displayValue(metadata?.openLibraryKey)}</span>
					{#if openLibraryUrl}
						<a class="external-link-btn" href={openLibraryUrl} target="_blank" rel="noopener noreferrer">Open</a>
					{/if}
				</div>
			</div>
			<div class="search-detail-row">
				<span class="label">ASIN</span>
				<div class="value with-action">
					<span>{displayValue(amazonAsin)}</span>
					{#if amazonAsin}
						<button type="button" class="copy-btn" onclick={() => void onCopy(amazonAsin, 'ASIN')}>Copy</button>
					{/if}
				</div>
			</div>
			<div class="search-detail-row">
				<span class="label">External Rating</span>
				<span class="value">
					{#if metadata?.externalRating !== null && metadata?.externalRating !== undefined}
						{metadata.externalRating}
						{#if metadata.externalRatingCount !== null && metadata.externalRatingCount !== undefined}
							({metadata.externalRatingCount} ratings)
						{/if}
					{:else}
						Not available
					{/if}
				</span>
			</div>
		</div>

		{#if metadata?.description ?? book.description}
			<div class="search-detail-description">
				<h4>Description</h4>
				<p>{metadata?.description ?? book.description}</p>
			</div>
		{/if}

		<div class="search-detail-actions">
			{#if book.capabilities.filesAvailable}
				<button type="button" class="search-detail-primary" onclick={() => onDownload(book)}>Download</button>
			{/if}
			{#if book.capabilities.filesAvailable}
				<button type="button" class="search-detail-secondary" onclick={() => onAddToLibrary(book)}>Add to Library</button>
			{/if}
			{#if !book.capabilities.filesAvailable}
				<span class="search-detail-info">This provider currently exposes metadata only.</span>
			{/if}
		</div>
	</div>
</div>
