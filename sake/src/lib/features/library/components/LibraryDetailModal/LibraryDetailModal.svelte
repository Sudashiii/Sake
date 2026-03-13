<script lang="ts">
	import BookDetailModalShell from '$lib/components/BookDetailModalShell/BookDetailModalShell.svelte';
	import EditIcon from '$lib/assets/icons/EditIcon.svelte';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import type { BookProgressHistoryEntry } from '$lib/types/Library/BookProgressHistory';
	import type { DetailTab, MetadataDraft } from '$lib/features/library/libraryView';
	import LibraryDetailOverviewTab from '../LibraryDetailOverviewTab/LibraryDetailOverviewTab.svelte';
	import LibraryDetailProgressTab from '../LibraryDetailProgressTab/LibraryDetailProgressTab.svelte';
	import LibraryDetailMetadataTab from '../LibraryDetailMetadataTab/LibraryDetailMetadataTab.svelte';
	import LibraryDetailDevicesTab from '../LibraryDetailDevicesTab/LibraryDetailDevicesTab.svelte';
	import styles from './LibraryDetailModal.module.scss';

	interface Props {
		selectedBook: LibraryBook;
		selectedBookDetail: LibraryBookDetail | null;
		shelves: LibraryShelf[];
		metadataDraft: MetadataDraft;
		activeDetailTab?: DetailTab;
		showProgressHistory?: boolean;
		isDetailLoading?: boolean;
		detailError?: string | null;
		isRefetchingMetadata?: boolean;
		isProgressHistoryLoading?: boolean;
		progressHistoryError?: string | null;
		progressHistory: BookProgressHistoryEntry[];
		isMovingToTrash?: boolean;
		isDownloadingLibraryFile?: boolean;
		isUpdatingRating?: boolean;
		isUpdatingReadState?: boolean;
		isUpdatingArchiveState?: boolean;
		isUpdatingNewBooksExclusion?: boolean;
		isUpdatingShelves?: boolean;
		isEditingMetadata?: boolean;
		isSavingMetadata?: boolean;
		removingDeviceId: string | null;
		onClose: () => void;
		onRefetchMetadata: () => void;
		onStartMetadataEdit: () => void;
		onSaveMetadataEdit: () => void;
		onCancelMetadataEdit: () => void;
		onSetRating: (rating: number | null) => void;
		onToggleShelfAssignment: (shelfId: number) => void;
		onDownloadFromLibrary: () => void;
		onToggleArchiveState: () => void;
		onToggleExcludeFromNewBooks: () => void;
		onToggleReadState: () => void;
		onOpenReset: () => void;
		onMoveToTrash: () => void;
		onRemoveDeviceDownload: (deviceId: string) => void;
	}

	let {
		selectedBook,
		selectedBookDetail,
		shelves,
		metadataDraft = $bindable(),
		activeDetailTab = $bindable('overview'),
		showProgressHistory = $bindable(false),
		isDetailLoading = false,
		detailError = null,
		isRefetchingMetadata = false,
		isProgressHistoryLoading = false,
		progressHistoryError = null,
		progressHistory,
		isMovingToTrash = false,
		isDownloadingLibraryFile = false,
		isUpdatingRating = false,
		isUpdatingReadState = false,
		isUpdatingArchiveState = false,
		isUpdatingNewBooksExclusion = false,
		isUpdatingShelves = false,
		isEditingMetadata = false,
		isSavingMetadata = false,
		removingDeviceId,
		onClose,
		onRefetchMetadata,
		onStartMetadataEdit,
		onSaveMetadataEdit,
		onCancelMetadataEdit,
		onSetRating,
		onToggleShelfAssignment,
		onDownloadFromLibrary,
		onToggleArchiveState,
		onToggleExcludeFromNewBooks,
		onToggleReadState,
		onOpenReset,
		onMoveToTrash,
		onRemoveDeviceDownload
	}: Props = $props();
</script>

<div class={styles.root}>
	<BookDetailModalShell title="Book Details" showTabs={true} {onClose}>
		{#snippet headerActions()}
			<button type="button" class="detail-v2-btn detail-v2-btn-secondary" onclick={onRefetchMetadata} disabled={isRefetchingMetadata}>
				<RefreshIcon size={14} decorative={true} />
				<span>{isRefetchingMetadata ? 'Refetching...' : 'Refetch'}</span>
			</button>
			{#if isEditingMetadata}
				<button type="button" class="detail-v2-btn detail-v2-btn-secondary" onclick={onCancelMetadataEdit} disabled={isSavingMetadata}>Cancel</button>
				<button type="button" class="detail-v2-btn detail-v2-btn-primary" onclick={onSaveMetadataEdit} disabled={isSavingMetadata}>
					{isSavingMetadata ? 'Saving...' : 'Save'}
				</button>
			{:else}
				<button type="button" class="detail-v2-btn detail-v2-btn-secondary" onclick={onStartMetadataEdit}>
					<EditIcon size={14} decorative={true} />
					<span>Edit</span>
				</button>
			{/if}
		{/snippet}
		{#snippet tabs()}
			<button type="button" role="tab" class:active={activeDetailTab === 'overview'} aria-selected={activeDetailTab === 'overview'} onclick={() => (activeDetailTab = 'overview')}>Overview</button>
			<button type="button" role="tab" class:active={activeDetailTab === 'progress'} aria-selected={activeDetailTab === 'progress'} onclick={() => (activeDetailTab = 'progress')}>Progress</button>
			<button type="button" role="tab" class:active={activeDetailTab === 'metadata'} aria-selected={activeDetailTab === 'metadata'} onclick={() => (activeDetailTab = 'metadata')}>Metadata</button>
			<button type="button" role="tab" class:active={activeDetailTab === 'devices'} aria-selected={activeDetailTab === 'devices'} onclick={() => (activeDetailTab = 'devices')}>
				Devices ({selectedBookDetail?.downloadedDevices.length ?? 0})
			</button>
		{/snippet}

		{#if isDetailLoading}
			<p class="detail-loading">Loading details...</p>
		{:else if detailError}
			<div class="detail-error">{detailError}</div>
		{:else if selectedBookDetail}
			{#if activeDetailTab === 'overview'}
				<LibraryDetailOverviewTab
					{selectedBook}
					{selectedBookDetail}
					bind:metadataDraft
					{isEditingMetadata}
					{shelves}
					{isUpdatingShelves}
					{isUpdatingRating}
					{isUpdatingArchiveState}
					{isUpdatingNewBooksExclusion}
					{isUpdatingReadState}
					{isDownloadingLibraryFile}
					{isMovingToTrash}
					onSetRating={onSetRating}
					onToggleShelfAssignment={onToggleShelfAssignment}
					onDownloadFromLibrary={onDownloadFromLibrary}
					onToggleArchiveState={onToggleArchiveState}
					onToggleExcludeFromNewBooks={onToggleExcludeFromNewBooks}
					onToggleReadState={onToggleReadState}
					onOpenReset={onOpenReset}
					onMoveToTrash={onMoveToTrash}
				/>
			{:else if activeDetailTab === 'progress'}
				<LibraryDetailProgressTab
					{selectedBookDetail}
					{progressHistory}
					{isProgressHistoryLoading}
					{progressHistoryError}
					bind:showProgressHistory
				/>
			{:else if activeDetailTab === 'metadata'}
				<LibraryDetailMetadataTab
					{selectedBook}
					{selectedBookDetail}
					bind:metadataDraft
					{isEditingMetadata}
				/>
			{:else}
				<LibraryDetailDevicesTab
					{selectedBookDetail}
					{removingDeviceId}
					onRemoveDeviceDownload={onRemoveDeviceDownload}
				/>
			{/if}
		{/if}
	</BookDetailModalShell>
</div>
