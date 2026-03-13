<script lang="ts">
	import BookDetailModalShell from '$lib/components/BookDetailModalShell/BookDetailModalShell.svelte';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import { clampProgress, formatDate, formatFileSize } from '$lib/features/library/libraryView';
	import styles from './ArchivedDetailModal.module.scss';

	interface Props {
		selectedBook: LibraryBook;
		selectedBookDetail: LibraryBookDetail | null;
		isDetailLoading?: boolean;
		detailError?: string | null;
		unarchivingBookId: number | null;
		onClose: () => void;
		onUnarchive: (book: LibraryBook) => void;
	}

	let {
		selectedBook,
		selectedBookDetail,
		isDetailLoading = false,
		detailError = null,
		unarchivingBookId,
		onClose,
		onUnarchive
	}: Props = $props();
</script>

<div class={styles.root}>
	<BookDetailModalShell title="Book Details" {onClose}>
		{#if isDetailLoading}
			<p class="detail-muted">Loading details...</p>
		{:else if detailError}
			<p class="detail-error">{detailError}</p>
		{:else if selectedBookDetail}
			<div class="detail-grid">
				<div>
					<p class="detail-label">Author</p>
					<p>{selectedBookDetail.author || 'Unknown author'}</p>
				</div>
				<div>
					<p class="detail-label">Format</p>
					<p>{selectedBook.extension?.toUpperCase() || 'EPUB'}</p>
				</div>
				<div>
					<p class="detail-label">Size</p>
					<p>{formatFileSize(selectedBook.filesize)}</p>
				</div>
				<div>
					<p class="detail-label">Archived</p>
					<p>{formatDate(selectedBook.archived_at ?? null)}</p>
				</div>
				<div>
					<p class="detail-label">Progress</p>
					<div class="detail-progress">
						<div class="detail-progress-track">
							<div class="detail-progress-fill" style={`width: ${clampProgress(selectedBookDetail.progressPercent)}%`}></div>
						</div>
						<span>{clampProgress(selectedBookDetail.progressPercent).toFixed(0)}%</span>
					</div>
				</div>
				<div>
					<p class="detail-label">Downloaded Devices</p>
					<p>{selectedBookDetail.downloadedDevices.length}</p>
				</div>
			</div>

			<div class="detail-actions">
				<button type="button" class="detail-unarchive" onclick={() => onUnarchive(selectedBook)} disabled={unarchivingBookId !== null}>
					{unarchivingBookId === selectedBook.id ? 'Saving...' : 'Unarchive'}
				</button>
			</div>
		{/if}
	</BookDetailModalShell>
</div>
