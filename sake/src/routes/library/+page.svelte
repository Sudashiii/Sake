<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ConfirmModal from '$lib/components/ConfirmModal/ConfirmModal.svelte';
	import Loading from '$lib/components/Loading/Loading.svelte';
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import LibraryBulkActionsBar from '$lib/features/library/components/LibraryBulkActionsBar/LibraryBulkActionsBar.svelte';
	import LibraryDetailModal from '$lib/features/library/components/LibraryDetailModal/LibraryDetailModal.svelte';
	import LibraryEmptyState from '$lib/features/library/components/LibraryEmptyState/LibraryEmptyState.svelte';
	import LibraryGridItem from '$lib/features/library/components/LibraryGridItem/LibraryGridItem.svelte';
	import LibraryListItem from '$lib/features/library/components/LibraryListItem/LibraryListItem.svelte';
	import LibraryStatsGrid from '$lib/features/library/components/LibraryStatsGrid/LibraryStatsGrid.svelte';
	import LibraryToolbar from '$lib/features/library/components/LibraryToolbar/LibraryToolbar.svelte';
	import TrashBookCard from '$lib/features/library/components/TrashBookCard/TrashBookCard.svelte';
	import {
		isSeriesSortPreference,
		parseViewFromUrl
	} from '$lib/features/library/libraryView';
	import { LibraryDetailController } from '$lib/features/library/controllers/libraryDetailController.svelte';
	import { LibraryListController } from '$lib/features/library/controllers/libraryListController.svelte';
	import { LibraryUploadController } from '$lib/features/library/controllers/libraryUploadController.svelte';
	import styles from './page.module.scss';

	const listController = new LibraryListController();
	const detailController = new LibraryDetailController({
		getCurrentView: () => listController.currentView,
		setCurrentView: (view) => {
			listController.currentView = view;
		},
		loadShelves: () => listController.loadShelves(),
		loadLibrary: () => listController.loadLibrary(),
		loadTrash: () => listController.loadTrash(),
		updateLibraryUrl: (openBookId) => listController.updateLibraryUrl(openBookId),
		openResetModal: (book) => listController.openResetModal(book),
		applyBookMetadataUpdate: (updated) => listController.applyBookMetadataUpdate(updated),
		setBookDownloadedState: (bookId, isDownloaded) =>
			listController.setBookDownloadedState(bookId, isDownloaded),
		setBookRatingState: (bookId, rating) => listController.setBookRatingState(bookId, rating),
		setBookCoverState: (bookId, cover) => listController.setBookCoverState(bookId, cover),
		setBookArchiveState: (bookId, archivedAt, excludeFromNewBooks) =>
			listController.setBookArchiveState(bookId, archivedAt, excludeFromNewBooks),
		setBookShelfIdsState: (bookId, shelfIds) => listController.setBookShelfIdsState(bookId, shelfIds),
		getIsUpdatingShelves: () => listController.isUpdatingShelves,
		setIsUpdatingShelves: (value) => {
			listController.isUpdatingShelves = value;
		}
	});
	const uploadController = new LibraryUploadController({
		getCurrentView: () => listController.currentView,
		onLibraryChanged: () => listController.loadLibrary()
	});

	let selectedShelfId = $derived.by(() => {
		if ($page.url.pathname !== '/library') {
			return null;
		}
		const raw = $page.url.searchParams.get('shelf');
		if (!raw) {
			return null;
		}
		const parsed = Number.parseInt(raw, 10);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	});

	$effect(() => {
		listController.selectedShelfId = selectedShelfId;
		listController.isDetailModalOpen = detailController.showDetailModal;
	});

	onMount(() => {
		(async () => {
			listController.initializeSortPreference();

			const params = new URLSearchParams(window.location.search);
			const requestedView = parseViewFromUrl(params.get('view'));
			const openBookIdParam = params.get('openBookId');
			const openBookId = openBookIdParam ? Number.parseInt(openBookIdParam, 10) : NaN;

			if (requestedView === 'archived') {
				const archivedTarget =
					Number.isNaN(openBookId) ? '/archived' : `/archived?openBookId=${openBookId}`;
				await goto(archivedTarget, { replaceState: true });
				return;
			}

			if (requestedView === 'trash') {
				await goto('/trash', { replaceState: true });
				return;
			}

			if (requestedView === 'library') {
				listController.currentView = 'library';
			}

			if (listController.currentView === 'trash') {
				await listController.loadTrash();
				return;
			}

			await listController.loadLibrary();
			await listController.loadShelves();

			if (!Number.isNaN(openBookId)) {
				const candidate = listController.books.find(
					(book) =>
						book.id === openBookId &&
						(listController.currentView !== 'archived' || Boolean(book.archived_at))
				);
				if (candidate) {
					await detailController.openDetailModal(candidate);
				}
			}
		})();
	});
</script>

<div
	class={`${styles.root} ${uploadController.isLibraryDropActive ? styles.dragActive : ''} ${listController.selectionMode ? styles.selectionActive : ''}`}
	role="region"
	aria-label="Library content"
	ondragenter={uploadController.handleLibraryDragEnter}
	ondragover={uploadController.handleLibraryDragOver}
	ondragleave={uploadController.handleLibraryDragLeave}
	ondrop={uploadController.handleLibraryDrop}
>
	<Loading bind:show={listController.isLoading} />

	{#if uploadController.isLibraryDropActive}
		<div class={styles.dropOverlay} aria-hidden="true">
			<div class={styles.dropPanel}>
				<p>Drop files to import them into your library</p>
				<span>Multiple files are supported.</span>
			</div>
		</div>
	{/if}

	{#if listController.error}
		<div class={styles.error}>
			<AlertCircleIcon size={18} decorative={true} />
			<p>{listController.error.message}</p>
			<button onclick={() => void listController.loadLibrary()}>Retry</button>
		</div>
	{/if}

	{#if listController.currentView === 'library'}
		<LibraryStatsGrid stats={listController.libraryStats} />
	{/if}

	<LibraryToolbar
		currentView={listController.currentView}
		bind:searchQuery={listController.searchQuery}
		statusFilter={listController.statusFilter}
		sortPreference={listController.sortPreference}
		bind:visualMode={listController.visualMode}
		bind:showFilters={listController.showFilters}
		bind:showSortFieldMenu={listController.showSortFieldMenu}
		isUploadingLibraryFile={uploadController.isUploadingLibraryFile}
		onSetSortField={listController.setSortField}
		onSetSortDirection={listController.setSortDirection}
		onSelectFilterOption={(option) => void listController.selectFilterOption(option)}
		onUploadChange={uploadController.handleLibraryUploadChange}
	/>

	{#if listController.currentView === 'library' && listController.selectionMode}
		<LibraryBulkActionsBar
			selectedCount={listController.selectedBookIds.length}
			visibleCount={listController.filteredLibraryBooks.length}
			shelves={listController.shelves}
			isPending={listController.isBulkActionPending}
			onDisableSelectionMode={listController.disableSelectionMode}
			onSelectAllVisible={listController.selectAllVisibleBooks}
			onClearSelection={listController.clearSelectedBooks}
			onArchiveSelected={() => void listController.handleBulkArchiveSelected()}
			onMarkReadSelected={() => void listController.handleBulkMarkReadSelected()}
			onMarkUnreadSelected={() => void listController.handleBulkMarkUnreadSelected()}
			onMoveToTrashSelected={listController.requestBulkMoveToTrash}
			onResetDownloadsSelected={() => void listController.handleBulkResetDownloadsSelected()}
			onAddSelectionToShelf={(shelfId) => void listController.handleBulkShelfSelection(shelfId, 'add')}
			onRemoveSelectionFromShelf={(shelfId) => void listController.handleBulkShelfSelection(shelfId, 'remove')}
		/>
	{/if}

	{#if listController.currentView === 'trash'}
		{#if listController.filteredTrashBooks.length > 0}
			<div class={styles.trashList}>
				{#each listController.filteredTrashBooks as book (book.id)}
					<TrashBookCard
						{book}
						restoringBookId={listController.restoringBookId}
						deletingTrashBookId={listController.deletingTrashBookId}
						onRestore={(targetBook) => void listController.handleRestoreBook(targetBook)}
						onDelete={listController.requestDeleteTrashedBook}
					/>
				{/each}
			</div>
		{:else if !listController.isLoading}
			<LibraryEmptyState
				title="Trash is empty"
				description="Books moved to trash will appear here for 30 days."
			/>
		{/if}
	{:else}
		{#if listController.visibleBooks.length > 0}
			{#if isSeriesSortPreference(listController.sortPreference)}
				<div class={styles.seriesGroups}>
					{#each listController.visibleBookGroups as group (group.id)}
						<section class={styles.seriesGroup} aria-label={`Series group ${group.label}`}>
							<div class={styles.seriesGroupHeader}>
								<h2>{group.label}</h2>
								<span class={styles.seriesGroupCount}>
									{group.books.length} book{group.books.length === 1 ? '' : 's'}
								</span>
							</div>
							{#if listController.visualMode === 'grid'}
								<div class={styles.bookGrid}>
									{#each group.books as book (book.id)}
										<LibraryGridItem
											{book}
											shelves={listController.shelves}
											showShelfAssign={listController.showShelfAssign === book.id}
											showShelfAssignControl={listController.currentView === 'library' && !listController.selectionMode}
											selectionMode={listController.selectionMode}
											selected={listController.selectedBookIds.includes(book.id)}
											selectionDisabled={listController.isBulkActionPending}
											onOpenDetail={(targetBook) => void detailController.openDetailModal(targetBook)}
											onStartSelectionMode={listController.startSelectionModeFromBook}
											onToggleSelected={listController.handleToggleSelectedBook}
											onToggleShelfAssignMenu={() => {
												listController.showShelfAssign =
													listController.showShelfAssign === book.id ? null : book.id;
											}}
											onCloseShelfAssignMenu={() => {
												listController.showShelfAssign = null;
											}}
											onToggleBookShelf={(shelfId) => void listController.handleToggleBookShelf(book.id, shelfId)}
										/>
									{/each}
								</div>
							{:else}
								<div class={styles.bookList}>
									{#each group.books as book (book.id)}
										<LibraryListItem
											{book}
											shelves={listController.shelves}
											showShelfAssign={listController.showShelfAssign === book.id}
											showShelfAssignControl={listController.currentView === 'library' && !listController.selectionMode}
											selectionMode={listController.selectionMode}
											selected={listController.selectedBookIds.includes(book.id)}
											selectionDisabled={listController.isBulkActionPending}
											onOpenDetail={(targetBook) => void detailController.openDetailModal(targetBook)}
											onStartSelectionMode={listController.startSelectionModeFromBook}
											onToggleSelected={listController.handleToggleSelectedBook}
											onToggleShelfAssignMenu={() => {
												listController.showShelfAssign =
													listController.showShelfAssign === book.id ? null : book.id;
											}}
											onCloseShelfAssignMenu={() => {
												listController.showShelfAssign = null;
											}}
											onToggleBookShelf={(shelfId) => void listController.handleToggleBookShelf(book.id, shelfId)}
										/>
									{/each}
								</div>
							{/if}
						</section>
					{/each}
				</div>
			{:else if listController.visualMode === 'grid'}
				<div class={styles.bookGrid}>
					{#each listController.visibleBooks as book (book.id)}
						<LibraryGridItem
							{book}
							shelves={listController.shelves}
							showShelfAssign={listController.showShelfAssign === book.id}
							showShelfAssignControl={listController.currentView === 'library' && !listController.selectionMode}
							selectionMode={listController.selectionMode}
							selected={listController.selectedBookIds.includes(book.id)}
							selectionDisabled={listController.isBulkActionPending}
							onOpenDetail={(targetBook) => void detailController.openDetailModal(targetBook)}
							onStartSelectionMode={listController.startSelectionModeFromBook}
							onToggleSelected={listController.handleToggleSelectedBook}
							onToggleShelfAssignMenu={() => {
								listController.showShelfAssign =
									listController.showShelfAssign === book.id ? null : book.id;
							}}
							onCloseShelfAssignMenu={() => {
								listController.showShelfAssign = null;
							}}
							onToggleBookShelf={(shelfId) => void listController.handleToggleBookShelf(book.id, shelfId)}
						/>
					{/each}
				</div>
			{:else}
				<div class={styles.bookList}>
					{#each listController.visibleBooks as book (book.id)}
						<LibraryListItem
							{book}
							shelves={listController.shelves}
							showShelfAssign={listController.showShelfAssign === book.id}
							showShelfAssignControl={listController.currentView === 'library' && !listController.selectionMode}
							selectionMode={listController.selectionMode}
							selected={listController.selectedBookIds.includes(book.id)}
							selectionDisabled={listController.isBulkActionPending}
							onOpenDetail={(targetBook) => void detailController.openDetailModal(targetBook)}
							onStartSelectionMode={listController.startSelectionModeFromBook}
							onToggleSelected={listController.handleToggleSelectedBook}
							onToggleShelfAssignMenu={() => {
								listController.showShelfAssign =
									listController.showShelfAssign === book.id ? null : book.id;
							}}
							onCloseShelfAssignMenu={() => {
								listController.showShelfAssign = null;
							}}
							onToggleBookShelf={(shelfId) => void listController.handleToggleBookShelf(book.id, shelfId)}
						/>
					{/each}
				</div>
			{/if}
		{:else if !listController.isLoading}
			{#if listController.currentView === 'library'}
				{#if selectedShelfId !== null}
					<LibraryEmptyState
						title="No books on this shelf yet"
						description="Add books using the bookmark icon on each book."
					/>
				{:else}
					<LibraryEmptyState
						title="Your library is empty"
						description="Search and download books from Z-Library to build your collection."
						showSearchLink={true}
					/>
				{/if}
			{:else}
				<LibraryEmptyState
					title="No archived books"
					description="Archive books from the detail view to keep them out of New Books downloads."
				/>
			{/if}
		{/if}
	{/if}
</div>

<ConfirmModal
	open={listController.showDeleteTrashModal}
	title="Delete permanently?"
	message={`Delete "${listController.pendingDeleteTrashBook?.title ?? 'this book'}" permanently? This removes it from the database and object storage.`}
	confirmLabel="Delete Permanently"
	cancelLabel="Cancel"
	danger={true}
	pending={listController.deletingTrashBookId !== null}
	onConfirm={() => void listController.confirmDeleteTrashedBook()}
	onCancel={listController.cancelDeleteTrashedBook}
/>

<ConfirmModal
	open={listController.showBulkTrashModal}
	title="Move selected books to trash?"
	message={`Move ${listController.selectedBookIds.length} selected book${listController.selectedBookIds.length === 1 ? '' : 's'} to trash? They will stay recoverable for 30 days.`}
	confirmLabel="Move To Trash"
	cancelLabel="Cancel"
	danger={true}
	pending={listController.isBulkActionPending}
	onConfirm={() => void listController.confirmBulkMoveToTrash()}
	onCancel={listController.cancelBulkMoveToTrash}
/>

<ConfirmModal
	open={listController.showConfirmModal && listController.bookToReset !== null}
	title="Reset Download Status"
	message={`This will mark "${listController.bookToReset?.title ?? 'this book'}" as not downloaded. The book will remain in your library; only the download status will be reset.`}
	confirmLabel="Reset Status"
	cancelLabel="Cancel"
	onConfirm={() => void listController.confirmResetStatus()}
	onCancel={listController.closeResetModal}
/>

{#if detailController.showDetailModal && detailController.selectedBook}
	<LibraryDetailModal
		selectedBook={detailController.selectedBook}
		selectedBookDetail={detailController.selectedBookDetail}
		shelves={listController.shelves}
		bind:metadataDraft={detailController.metadataDraft}
		bind:activeDetailTab={detailController.activeDetailTab}
		bind:showProgressHistory={detailController.showProgressHistory}
		isDetailLoading={detailController.isDetailLoading}
		detailError={detailController.detailError}
		isRefetchingMetadata={detailController.isRefetchingMetadata}
		isProgressHistoryLoading={detailController.isProgressHistoryLoading}
		progressHistoryError={detailController.progressHistoryError}
		progressHistory={detailController.progressHistory}
		isMovingToTrash={detailController.isMovingToTrash}
		isDownloadingLibraryFile={detailController.isDownloadingLibraryFile}
		isUpdatingRating={detailController.isUpdatingRating}
		isUpdatingReadState={detailController.isUpdatingReadState}
		isUpdatingArchiveState={detailController.isUpdatingArchiveState}
		isUpdatingNewBooksExclusion={detailController.isUpdatingNewBooksExclusion}
		isUpdatingShelves={listController.isUpdatingShelves}
		isEditingMetadata={detailController.isEditingMetadata}
		isSavingMetadata={detailController.isSavingMetadata}
		isImportingCover={detailController.isImportingCover}
		removingDeviceId={detailController.removingDeviceId}
		onClose={detailController.closeDetailModal.bind(detailController)}
		onRefetchMetadata={() => void detailController.handleRefetchMetadata()}
		onStartMetadataEdit={detailController.startMetadataEdit.bind(detailController)}
		onSaveMetadataEdit={() => void detailController.saveMetadataEdit()}
		onCancelMetadataEdit={detailController.cancelMetadataEdit.bind(detailController)}
		onImportCover={() => void detailController.handleImportCover()}
		onSetRating={(rating) => void detailController.handleSetRating(rating)}
		onToggleShelfAssignment={(shelfId) => void detailController.handleToggleShelfAssignment(shelfId)}
		onDownloadFromLibrary={() => void detailController.handleDownloadFromLibrary()}
		onToggleArchiveState={() => void detailController.handleToggleArchiveState()}
		onToggleExcludeFromNewBooks={() => void detailController.handleToggleExcludeFromNewBooks()}
		onToggleReadState={() => void detailController.handleToggleReadState()}
		onOpenReset={detailController.openResetFromDetail.bind(detailController)}
		onMoveToTrash={() => void detailController.handleMoveToTrash()}
		onRemoveDeviceDownload={(deviceId) => void detailController.handleRemoveDeviceDownload(deviceId)}
	/>
{/if}
