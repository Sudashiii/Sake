<script lang="ts">
	import ArchiveBoxIcon from '$lib/assets/icons/ArchiveBoxIcon.svelte';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import {
		formatDate,
		formatFileSize,
		getBookStatus,
		getFormatBadgeClass,
		getProgressPercent,
		getRoundedRating
	} from '$lib/features/library/libraryView';
	import styles from './ArchivedBookCard.module.scss';

	interface Props {
		book: LibraryBook;
		unarchivingBookId: number | null;
		onOpenDetail: (book: LibraryBook) => void;
		onUnarchive: (book: LibraryBook) => void;
	}

	let { book, unarchivingBookId, onOpenDetail, onUnarchive }: Props = $props();

	function getStatusLabel(): string {
		const status = getBookStatus(book);
		if (status === 'read') return 'Read';
		if (status === 'reading') return 'Reading';
		return 'Unread';
	}
</script>

<div
	class={styles.root}
	role="button"
	tabindex="0"
	aria-label={`Show details for ${book.title}`}
	onclick={() => onOpenDetail(book)}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onOpenDetail(book);
		}
	}}
>
	<div class="book-cover-wrap">
		{#if book.cover}
			<img src={book.cover} alt={book.title} loading="lazy" />
		{:else}
			<div class="book-cover-fallback">No cover</div>
		{/if}
	</div>

	<div class="book-main">
		<p class="book-title" title={book.title}>{book.title}</p>
		<p class="book-author">{book.author ?? 'Unknown author'}</p>

		<div class="book-tags">
			{#if book.extension}
				<span class={`format-badge ${getFormatBadgeClass(book.extension)}`}>{book.extension.toUpperCase()}</span>
			{/if}
			<span class={`status-pill ${getBookStatus(book)}`}>{getStatusLabel()}</span>
			<span class="book-size">{formatFileSize(book.filesize)}</span>
			<div class="book-stars" aria-label={`Rating ${book.rating ?? 0} out of 5`}>
				{#each [1, 2, 3, 4, 5] as star}
					<span class:filled={star <= getRoundedRating(book.rating)}>★</span>
				{/each}
			</div>
		</div>

		<div class="book-submeta">
			<span>Added {formatDate(book.createdAt)}</span>
			{#if getProgressPercent(book) > 0}
				{@const progress = getProgressPercent(book)}
				<div class="mini-progress">
					<div class="mini-progress-track">
						<div class="mini-progress-fill" style={`width: ${progress}%`}></div>
					</div>
					<span>{progress}%</span>
				</div>
			{/if}
		</div>
	</div>

	<div class="card-actions">
		<button
			type="button"
			onclick={(event) => {
				event.stopPropagation();
				onUnarchive(book);
			}}
			disabled={unarchivingBookId !== null}
		>
			<ArchiveBoxIcon size={14} decorative={true} />
			<span>{unarchivingBookId === book.id ? 'Saving...' : 'Unarchive'}</span>
		</button>
	</div>
</div>
