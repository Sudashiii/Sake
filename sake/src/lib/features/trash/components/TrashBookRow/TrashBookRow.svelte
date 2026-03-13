<script lang="ts">
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
	import Trash2Icon from '$lib/assets/icons/Trash2Icon.svelte';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import { formatDate, formatFileSize, getFormatBadgeClass } from '$lib/features/library/libraryView';
	import styles from './TrashBookRow.module.scss';

	interface Props {
		book: LibraryBook;
		confirmingDeleteBookId: number | null;
		restoringBookId: number | null;
		deletingBookId: number | null;
		emptyingAll?: boolean;
		onRestore: (book: LibraryBook) => void;
		onConfirmDelete: (bookId: number | null) => void;
		onDelete: (book: LibraryBook) => void;
	}

	let {
		book,
		confirmingDeleteBookId,
		restoringBookId,
		deletingBookId,
		emptyingAll = false,
		onRestore,
		onConfirmDelete,
		onDelete
	}: Props = $props();

	function getDaysUntilDeletion(value: string | null | undefined): number | null {
		if (!value) return null;
		const now = new Date();
		const target = new Date(value);
		if (Number.isNaN(target.getTime())) return null;
		const diff = target.getTime() - now.getTime();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	}
</script>

<article class={styles.root}>
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
		<div class="book-meta-row">
			{#if book.extension}
				<span class={`format-badge ${getFormatBadgeClass(book.extension)}`}>{book.extension.toUpperCase()}</span>
			{/if}
			<span class="book-size">{formatFileSize(book.filesize)}</span>
		</div>
		<div class="trash-meta-row">
			<span>Trashed {formatDate(book.deleted_at ?? null)}</span>
			{#if getDaysUntilDeletion(book.trash_expires_at) !== null}
				{@const daysLeft = getDaysUntilDeletion(book.trash_expires_at)!}
				<span class:urgent={daysLeft <= 7}>
					<AlertCircleIcon size={12} decorative={true} />
					{daysLeft > 0 ? `Deletes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Scheduled for deletion'}
					<em>({formatDate(book.trash_expires_at ?? null)})</em>
				</span>
			{/if}
		</div>
	</div>

	<div class="card-actions">
		<button
			type="button"
			class="restore-btn"
			onclick={() => onRestore(book)}
			disabled={restoringBookId !== null || deletingBookId !== null || emptyingAll}
		>
			<RefreshIcon size={14} decorative={true} />
			<span>{restoringBookId === book.id ? 'Restoring...' : 'Restore'}</span>
		</button>

		{#if confirmingDeleteBookId === book.id}
			<div class="confirm-delete">
				<button type="button" class="confirm-btn" onclick={() => onDelete(book)} disabled={deletingBookId !== null || emptyingAll}>
					{deletingBookId === book.id ? 'Deleting...' : 'Confirm'}
				</button>
				<button type="button" class="cancel-btn" onclick={() => onConfirmDelete(null)} disabled={deletingBookId !== null || emptyingAll}>
					Cancel
				</button>
			</div>
		{:else}
			<button
				type="button"
				class="delete-icon-btn"
				onclick={() => onConfirmDelete(book.id)}
				disabled={restoringBookId !== null || deletingBookId !== null || emptyingAll}
				title="Delete permanently"
			>
				<Trash2Icon size={16} decorative={true} />
			</button>
		{/if}
	</div>
</article>
