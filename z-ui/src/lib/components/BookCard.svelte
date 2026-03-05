<script lang="ts">
	import DownloadIcon from "$lib/assets/icons/DownloadIcon.svelte";
	import ShareIcon from "$lib/assets/icons/ShareIcon.svelte";
	import type { ZBook } from "$lib/types/ZLibrary/ZBook";

	interface Props {
		book: ZBook;
		onDownload: (book: ZBook) => void;
		onShare: (book: ZBook) => void;
		onOpenDetails: (book: ZBook) => void;
	}

	const { book, onDownload, onShare, onOpenDetails }: Props = $props();
</script>

<article class="book-card">
	<button
		type="button"
		class="book-main"
		aria-label={`Open details for ${book.title}`}
		onclick={() => onOpenDetails(book)}
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
				<p class="book-author">by {book.author}</p>
			</div>
			<div class="book-meta">
				<span class="meta-tag format">{book.extension?.toUpperCase()}</span>
				<span class="meta-tag">{book.language}</span>
				{#if book.year}
					<span class="meta-tag">{book.year}</span>
				{/if}
				<span class="meta-tag">{book.filesizeString}</span>
			</div>
			{#if book.publisher}
				<p class="book-publisher">Published by {book.publisher}</p>
			{/if}
			<div class="book-scores">
				{#if book.interestScore}
					<span class="score">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
							<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
						</svg>
						{book.interestScore}
					</span>
				{/if}
				{#if book.qualityScore}
					<span class="score quality">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
							<path d="m9 12 2 2 4-4"></path>
						</svg>
						{book.qualityScore}
					</span>
				{/if}
			</div>
		</div>
	</button>
	<div class="book-actions">
		<button
			class="action-btn primary"
			onclick={(event) => {
				event.stopPropagation();
				onDownload(book);
			}}
			title="Download to device"
		>
			<DownloadIcon />
			<span class="action-label">Download</span>
		</button>
		<button
			class="action-btn secondary"
			onclick={(event) => {
				event.stopPropagation();
				onShare(book);
			}}
			title="Add to library"
		>
			<ShareIcon />
			<span class="action-label">Library</span>
		</button>
	</div>
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

	.book-publisher {
		margin: 0;
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.book-scores {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.score {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.7rem;
		color: var(--color-primary);
	}

	.score.quality {
		color: var(--color-success);
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
