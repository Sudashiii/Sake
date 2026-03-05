<script lang="ts">
	import DownloadIcon from "$lib/assets/icons/DownloadIcon.svelte";
	import ShareIcon from "$lib/assets/icons/ShareIcon.svelte";
	import type { SearchResultBook } from "$lib/types/Search/SearchResultBook";

	interface Props {
		book: SearchResultBook;
		onDownload?: (book: SearchResultBook) => void;
		onShare?: (book: SearchResultBook) => void;
		onOpenDetails?: (book: SearchResultBook) => void;
	}

	const { book, onDownload, onShare, onOpenDetails }: Props = $props();

	function formatFileSize(sizeInBytes: number | null): string {
		if (typeof sizeInBytes !== "number" || !Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
			return "Unknown size";
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
			case "zlibrary":
				return "Z-Library";
			case "openlibrary":
				return "OpenLibrary";
			case "gutenberg":
				return "Gutenberg";
			default:
				return book.provider;
		}
	});
	const filesAvailable = $derived(book.capabilities.filesAvailable);
	const canDownload = $derived(Boolean(onDownload) && filesAvailable);
	const canShare = $derived(Boolean(onShare) && filesAvailable);
	const hasActions = $derived(canDownload || canShare);
</script>

<article class="book-card">
	<button
		type="button"
		class="book-main"
		aria-label={`Open details for ${book.title}`}
		onclick={() => onOpenDetails?.(book)}
	>
		<div class="book-cover">
			{#if book.cover}
				<img src={book.cover} alt={book.title} loading="lazy" />
			{:else}
				<div class="no-cover">
					<span class="extension">{book.extension?.toUpperCase() || "?"}</span>
				</div>
			{/if}
		</div>
		<div class="book-content">
			<div class="book-header">
				<h3 class="book-title" title={book.title}>{book.title}</h3>
				<p class="book-author">by {book.author ?? "Unknown author"}</p>
			</div>
			<div class="book-meta">
				<span class="meta-tag provider">{providerLabel}</span>
				{#if book.extension}
					<span class="meta-tag format">{book.extension.toUpperCase()}</span>
				{/if}
				{#if book.language}
					<span class="meta-tag">{book.language}</span>
				{/if}
				{#if book.year}
					<span class="meta-tag">{book.year}</span>
				{/if}
				<span class="meta-tag">{formatFileSize(book.filesize)}</span>
			</div>
		</div>
	</button>
	{#if hasActions}
		<div class="book-actions">
			{#if canDownload}
				<button
					class="action-btn primary"
					onclick={(event) => {
						event.stopPropagation();
						onDownload?.(book);
					}}
					title="Download to device"
				>
					<DownloadIcon />
					<span class="action-label">Download</span>
				</button>
			{/if}
			{#if canShare}
				<button
					class="action-btn secondary"
					onclick={(event) => {
						event.stopPropagation();
						onShare?.(book);
					}}
					title="Add to library"
				>
					<ShareIcon />
					<span class="action-label">Library</span>
				</button>
			{/if}
		</div>
	{/if}
</article>

<style>
	.book-card {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
		padding: 0.82rem;
		border-radius: 0.78rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		transition: border-color 0.16s ease;
		min-width: 0;
	}

	.book-card:hover {
		border-color: rgba(201, 169, 98, 0.3);
	}

	.book-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.book-main:focus-visible {
		outline: 2px solid rgba(201, 169, 98, 0.68);
		outline-offset: 3px;
		border-radius: 0.5rem;
	}

	.book-cover {
		flex-shrink: 0;
		width: 4rem;
		height: 5.5rem;
		border-radius: 0.48rem;
		overflow: hidden;
		background: #1f2430;
	}

	.book-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-cover {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		background: #202532;
	}

	.no-cover .extension {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.book-content {
		flex: 1;
		display: grid;
		gap: 0.34rem;
		min-width: 0;
	}

	.book-header {
		min-width: 0;
		overflow: hidden;
	}

	.book-title {
		display: block;
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-primary);
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.book-author {
		display: block;
		margin: 0;
		font-size: 0.78rem;
		color: var(--color-text-muted);
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.book-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.32rem;
	}

	.meta-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.12rem 0.36rem;
		border-radius: 0.3rem;
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.045em;
		text-transform: uppercase;
		background: #232834;
		color: var(--color-text-secondary);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.meta-tag.format {
		background: rgba(96, 165, 250, 0.2);
		color: #8fc3ff;
		border-color: rgba(96, 165, 250, 0.32);
	}

	.meta-tag.provider {
		background: rgba(201, 169, 98, 0.13);
		color: var(--color-primary);
		border-color: rgba(201, 169, 98, 0.24);
	}

	.book-actions {
		display: flex;
		flex-direction: column;
		gap: 0.34rem;
		flex-shrink: 0;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.34rem;
		min-width: 6.2rem;
		padding: 0.42rem 0.65rem;
		border-radius: 0.48rem;
		font-size: 0.72rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		cursor: pointer;
	}

	.action-btn.primary {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	.action-btn.primary:hover {
		filter: brightness(1.05);
	}

	.action-btn.secondary {
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
	}

	.action-btn.secondary:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.15);
	}

	@media (max-width: 700px) {
		.book-card {
			padding: 0.7rem;
			gap: 0.72rem;
			flex-wrap: wrap;
			align-items: flex-start;
		}

		.book-cover {
			width: 3.4rem;
			height: 4.8rem;
		}

		.book-main {
			flex: 1 1 calc(100% - 0rem);
		}

		.book-content {
			min-width: 0;
			flex: 1 1 calc(100% - 4.12rem);
		}

		.book-title {
			font-size: 0.78rem;
			line-height: 1.28;
			display: -webkit-box;
			line-clamp: 3;
			-webkit-line-clamp: 3;
			-webkit-box-orient: vertical;
			overflow: hidden;
			white-space: normal;
		}

		.book-author {
			white-space: normal;
			line-height: 1.25;
		}

		.book-actions {
			order: 3;
			flex-direction: row;
			width: 100%;
			margin-top: 0.2rem;
		}

		.action-btn {
			flex: 1;
			min-width: 0;
			padding: 0.5rem 0.65rem;
		}
	}
</style>
