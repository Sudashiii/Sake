<script lang="ts">
	import EditIcon from '$lib/assets/icons/EditIcon.svelte';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import {
		clampProgress,
		formatDate,
		formatFileSize,
		formatLibraryPublicationDate,
		getCurrentPage,
		getDetailStatusClass,
		getDetailStatusLabel,
		getFormatBadgeClass,
		parseNullableNumber,
		type MetadataDraft
	} from '$lib/features/library/libraryView';
	import styles from './LibraryDetailOverviewTab.module.scss';

	interface Props {
		selectedBook: LibraryBook;
		selectedBookDetail: LibraryBookDetail;
		metadataDraft: MetadataDraft;
		isEditingMetadata?: boolean;
		shelves: LibraryShelf[];
		isUpdatingShelves?: boolean;
		isUpdatingRating?: boolean;
		isUpdatingArchiveState?: boolean;
		isUpdatingNewBooksExclusion?: boolean;
		isUpdatingReadState?: boolean;
		isDownloadingLibraryFile?: boolean;
		isMovingToTrash?: boolean;
		onUploadCoverFile: (event: Event) => void;
		onSetRating: (rating: number | null) => void;
		onToggleShelfAssignment: (shelfId: number) => void;
		onDownloadFromLibrary: () => void;
		onToggleArchiveState: () => void;
		onToggleExcludeFromNewBooks: () => void;
		onToggleReadState: () => void;
		onOpenReset: () => void;
		onMoveToTrash: () => void;
	}

	let {
		selectedBook,
		selectedBookDetail,
		metadataDraft = $bindable(),
		isEditingMetadata = false,
		shelves,
		isUpdatingShelves = false,
		isUpdatingRating = false,
		isUpdatingArchiveState = false,
		isUpdatingNewBooksExclusion = false,
		isUpdatingReadState = false,
		isDownloadingLibraryFile = false,
		isMovingToTrash = false,
		onUploadCoverFile,
		onSetRating,
		onToggleShelfAssignment,
		onDownloadFromLibrary,
		onToggleArchiveState,
		onToggleExcludeFromNewBooks,
		onToggleReadState,
		onOpenReset,
		onMoveToTrash
	}: Props = $props();

	function formatTime(dateStr: string | null): string {
		if (!dateStr) {
			return '';
		}

		return new Intl.DateTimeFormat(undefined, {
			timeStyle: 'short'
		}).format(new Date(dateStr));
	}

	let coverUploadInput = $state<HTMLInputElement | null>(null);

	function openCoverUploadPicker(): void {
		if (!isEditingMetadata) {
			return;
		}
		coverUploadInput?.click();
	}
</script>

<div class={styles.root}>
	<div class="detail-v2-overview-main">
		<div class="detail-v2-cover-shell">
			<input
				bind:this={coverUploadInput}
				class="detail-v2-cover-upload-input"
				type="file"
				accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
				onchange={onUploadCoverFile}
			/>
			<button
				type="button"
				class={`detail-v2-cover ${isEditingMetadata ? 'editable' : ''}`}
				onclick={openCoverUploadPicker}
				disabled={!isEditingMetadata}
				aria-label={isEditingMetadata ? 'Upload a new cover image' : undefined}
			>
				{#if metadataDraft.cover || selectedBook.cover}
					<img src={metadataDraft.cover || selectedBook.cover || ''} alt={selectedBookDetail.title} loading="lazy" />
				{:else}
					<div class="no-cover"><span class="extension">{selectedBook.extension?.toUpperCase() || '?'}</span></div>
				{/if}
				{#if isEditingMetadata}
					<span class="detail-v2-cover-overlay" aria-hidden="true">
						<EditIcon size={18} decorative={true} />
					</span>
				{/if}
			</button>
		</div>
		<div class="detail-v2-info">
			{#if isEditingMetadata}
				<input class="detail-v2-input detail-v2-title-input" bind:value={metadataDraft.title} />
			{:else}
				<h1>{selectedBookDetail.title}</h1>
			{/if}

			{#if isEditingMetadata}
				<input class="detail-v2-input" bind:value={metadataDraft.author} />
			{:else}
				<p class="detail-v2-author">{selectedBookDetail.author || 'Unknown author'}</p>
			{/if}

			<div class="detail-v2-chip-row">
				{#if selectedBook.extension}
					<span class={`detail-v2-format-badge ${getFormatBadgeClass(selectedBook.extension)}`}>{selectedBook.extension.toUpperCase()}</span>
				{/if}
				<span class={`detail-v2-status-badge ${getDetailStatusClass(selectedBookDetail)}`}>{getDetailStatusLabel(selectedBookDetail)}</span>
				<span class="detail-v2-size">{formatFileSize(selectedBook.filesize)}</span>
			</div>

			<div class="detail-v2-rating">
				<p class="detail-v2-caption">Rating</p>
				<div class="rating-row" role="group" aria-label="Book rating">
					{#each [1, 2, 3, 4, 5] as star}
						<button type="button" class={`rating-star ${star <= (selectedBookDetail.rating ?? 0) ? 'active' : ''}`} aria-label={`Set rating to ${star} star${star === 1 ? '' : 's'}`} onclick={() => onSetRating(star)} disabled={isUpdatingRating}>★</button>
					{/each}
					{#if (selectedBookDetail.rating ?? 0) > 0}
						<button type="button" class="rating-clear-btn" aria-label="Clear rating" onclick={() => onSetRating(null)} disabled={isUpdatingRating}>Clear</button>
					{/if}
				</div>
			</div>

			<div class="detail-v2-progress">
				<div class="detail-v2-progress-head">
					<p class="detail-v2-caption">Reading Progress</p>
					<span>{clampProgress(selectedBookDetail.progressPercent).toFixed(0)}%</span>
				</div>
				<div class="detail-v2-progress-track"><div class="detail-v2-progress-fill" style={`width: ${clampProgress(selectedBookDetail.progressPercent)}%`}></div></div>
			</div>
		</div>
	</div>

	<div class="detail-v2-description">
		<p class="detail-v2-caption">Description</p>
		{#if isEditingMetadata}
			<textarea rows="3" class="detail-v2-textarea" bind:value={metadataDraft.description}></textarea>
		{:else}
			<p>{selectedBookDetail.description || 'No description available.'}</p>
		{/if}
	</div>

	<div class="detail-v2-quick-meta">
		<div>
			<p class="detail-v2-caption">Published Date</p>
			<strong>
				{#if isEditingMetadata}
					{formatLibraryPublicationDate({
						year: parseNullableNumber(metadataDraft.year),
						month: parseNullableNumber(metadataDraft.month),
						day: parseNullableNumber(metadataDraft.day)
					})}
				{:else}
					{formatLibraryPublicationDate(selectedBookDetail)}
				{/if}
			</strong>
		</div>
		<div><p class="detail-v2-caption">Pages</p><strong>{metadataDraft.pages || selectedBookDetail.pages || '—'}</strong></div>
		<div><p class="detail-v2-caption">Language</p><strong>{metadataDraft.language || selectedBook.language || '—'}</strong></div>
		<div>
			<p class="detail-v2-caption">Date Added</p>
			<div class="detail-v2-date-added">
				{#if isEditingMetadata}
					<input
						class="detail-v2-input"
						type="datetime-local"
						bind:value={metadataDraft.createdAt}
					/>
				{:else}
					<strong>{formatDate(selectedBook.createdAt)}</strong>
					{#if selectedBook.createdAt}
						<span>{formatTime(selectedBook.createdAt)}</span>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	{#if selectedBookDetail.externalRating !== null}
		<div class="detail-v2-external-rating">
			<span class="detail-v2-star">★</span>
			<span>{selectedBookDetail.externalRating.toFixed(2)}/5</span>
			<span>({(selectedBookDetail.externalRatingCount ?? 0).toLocaleString()} ratings)</span>
		</div>
	{/if}

	<div class="detail-v2-shelves">
		<div class="detail-v2-shelves-head"><p class="detail-v2-caption">Shelves</p><span>{selectedBookDetail.shelfIds.length} selected</span></div>
		{#if shelves.length === 0}
			<p class="detail-muted">Create a shelf above to organize this book.</p>
		{:else}
			<div class="detail-v2-shelf-list">
				{#each shelves as shelf (shelf.id)}
					<button type="button" class={`detail-v2-shelf-item ${selectedBookDetail.shelfIds.includes(shelf.id) ? 'active' : ''}`} onclick={() => onToggleShelfAssignment(shelf.id)} disabled={isUpdatingShelves}>
						<span class="detail-v2-shelf-icon">{shelf.icon}</span>
						<span>{shelf.name}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="detail-v2-actions">
		<button class="detail-v2-btn detail-v2-btn-secondary" onclick={onDownloadFromLibrary} disabled={isDownloadingLibraryFile}>{isDownloadingLibraryFile ? 'Downloading...' : 'Download'}</button>
		<button class="detail-v2-btn detail-v2-btn-secondary" onclick={onToggleArchiveState} disabled={isUpdatingArchiveState}>{isUpdatingArchiveState ? 'Saving...' : selectedBookDetail.isArchived ? 'Unarchive' : 'Archive'}</button>
		<button class="detail-v2-btn detail-v2-btn-secondary" onclick={onToggleExcludeFromNewBooks} disabled={isUpdatingNewBooksExclusion || selectedBookDetail.isArchived}>{isUpdatingNewBooksExclusion ? 'Saving...' : selectedBookDetail.excludeFromNewBooks ? 'Include In New' : 'Exclude From New'}</button>
		<button class="detail-v2-btn detail-v2-btn-secondary" onclick={onToggleReadState} disabled={isUpdatingReadState}>{isUpdatingReadState ? 'Saving...' : selectedBookDetail.isRead ? 'Mark Unread' : 'Mark Read'}</button>
		{#if selectedBook.isDownloaded}
			<button class="detail-v2-btn detail-v2-btn-secondary" onclick={onOpenReset}>Reset Download</button>
		{/if}
		<button class="detail-v2-btn detail-v2-btn-danger" onclick={onMoveToTrash} disabled={isMovingToTrash}>{isMovingToTrash ? 'Moving...' : 'Move To Trash'}</button>
	</div>
</div>
