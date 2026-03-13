<script lang="ts">
	import styles from './TrashBookCard.module.scss';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import { formatDate } from '$lib/features/library/libraryView';

	interface Props {
		book: LibraryBook;
		restoringBookId: number | null;
		deletingTrashBookId: number | null;
		onRestore: (book: LibraryBook) => void;
		onDelete: (book: LibraryBook) => void;
	}

	let { book, restoringBookId, deletingTrashBookId, onRestore, onDelete }: Props = $props();
</script>

<div class={styles.root}>
	<div class="trash-cover">
		{#if book.cover}
			<img src={book.cover} alt={book.title} loading="lazy" />
		{:else}
			<div class="no-cover"><span class="extension">{book.extension?.toUpperCase() || '?'}</span></div>
		{/if}
	</div>
	<div class="trash-main">
		<h3 title={book.title}>{book.title}</h3>
		<p>{book.author || 'Unknown author'}</p>
		<div class="trash-meta">
			<span>Deleted {formatDate(book.deleted_at ?? null)}</span>
			<span>Auto-delete {formatDate(book.trash_expires_at ?? null)}</span>
		</div>
	</div>
	<div class="trash-actions">
		<button class="detail-refetch-btn" onclick={() => onRestore(book)} disabled={restoringBookId !== null || deletingTrashBookId !== null}>
			{restoringBookId === book.id ? 'Restoring...' : 'Restore'}
		</button>
		<button class="detail-remove-btn" onclick={() => onDelete(book)} disabled={restoringBookId !== null || deletingTrashBookId !== null}>
			{deletingTrashBookId === book.id ? 'Deleting...' : 'Delete'}
		</button>
	</div>
</div>
