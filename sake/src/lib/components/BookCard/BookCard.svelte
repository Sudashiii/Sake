<script lang="ts">
	import DownloadIcon from '$lib/assets/icons/DownloadIcon.svelte';
	import ShareIcon from '$lib/assets/icons/ShareIcon.svelte';
	import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
	import styles from './BookCard.module.scss';

	interface Props {
		book: SearchResultBook;
		onDownload?: (book: SearchResultBook) => void;
		onShare?: (book: SearchResultBook) => void;
		onOpenDetails?: (book: SearchResultBook) => void;
	}

	const { book, onDownload, onShare, onOpenDetails }: Props = $props();

	function formatFileSize(sizeInBytes: number | null): string {
		if (typeof sizeInBytes !== 'number' || !Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
			return 'Unknown size';
		}

		if (sizeInBytes < 1024) {
			return `${sizeInBytes} B`;
		}

		if (sizeInBytes < 1024 * 1024) {
			return `${Math.round(sizeInBytes / 1024)} KB`;
		}

		return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	const providerLabel = $derived.by(() => {
		switch (book.provider) {
			case 'zlibrary':
				return 'Z-Library';
			case 'openlibrary':
				return 'OpenLibrary';
			case 'gutenberg':
				return 'Gutenberg';
			default:
				return book.provider;
		}
	});
	const filesAvailable = $derived(book.capabilities.filesAvailable);
	const canDownload = $derived(Boolean(onDownload) && filesAvailable);
	const canShare = $derived(Boolean(onShare) && filesAvailable);
	const hasActions = $derived(canDownload || canShare);
</script>

<article class={styles.bookCard}>
	<button
		type="button"
		class={styles.bookMain}
		aria-label={`Open details for ${book.title}`}
		onclick={() => onOpenDetails?.(book)}
	>
		<div class={styles.bookCover}>
			{#if book.cover}
				<img src={book.cover} alt={book.title} loading="lazy" />
			{:else}
				<div class={styles.noCover}>
					<span class={styles.extension}>{book.extension?.toUpperCase() || '?'}</span>
				</div>
			{/if}
		</div>
		<div class={styles.bookContent}>
			<div class={styles.bookHeader}>
				<h3 class={styles.bookTitle} title={book.title}>{book.title}</h3>
				<p class={styles.bookAuthor}>by {book.author ?? 'Unknown author'}</p>
			</div>
			<div class={styles.bookMeta}>
				<span class={`${styles.metaTag} ${styles.providerTag}`}>{providerLabel}</span>
				{#if book.extension}
					<span class={`${styles.metaTag} ${styles.formatTag}`}>{book.extension.toUpperCase()}</span>
				{/if}
				{#if book.language}
					<span class={styles.metaTag}>{book.language}</span>
				{/if}
				{#if book.year}
					<span class={styles.metaTag}>{book.year}</span>
				{/if}
				<span class={styles.metaTag}>{formatFileSize(book.filesize)}</span>
			</div>
		</div>
	</button>
	{#if hasActions}
		<div class={styles.bookActions}>
			{#if canDownload}
				<button
					class={`${styles.actionButton} ${styles.primaryAction}`}
					onclick={(event) => {
						event.stopPropagation();
						onDownload?.(book);
					}}
					title="Download to device"
				>
					<DownloadIcon />
					<span class={styles.actionLabel}>Download</span>
				</button>
			{/if}
			{#if canShare}
				<button
					class={`${styles.actionButton} ${styles.secondaryAction}`}
					onclick={(event) => {
						event.stopPropagation();
						onShare?.(book);
					}}
					title="Add to library"
				>
					<ShareIcon />
					<span class={styles.actionLabel}>Library</span>
				</button>
			{/if}
		</div>
	{/if}
</article>
