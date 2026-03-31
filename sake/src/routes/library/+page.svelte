<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ConfirmModal from '$lib/components/ConfirmModal/ConfirmModal.svelte';
	import Loading from '$lib/components/Loading/Loading.svelte';
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import { ZUI } from '$lib/client/zui';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import LibraryBulkActionsBar from '$lib/features/library/components/LibraryBulkActionsBar/LibraryBulkActionsBar.svelte';
	import LibraryDetailModal from '$lib/features/library/components/LibraryDetailModal/LibraryDetailModal.svelte';
	import LibraryEmptyState from '$lib/features/library/components/LibraryEmptyState/LibraryEmptyState.svelte';
	import LibraryGridItem from '$lib/features/library/components/LibraryGridItem/LibraryGridItem.svelte';
	import LibraryListItem from '$lib/features/library/components/LibraryListItem/LibraryListItem.svelte';
	import LibraryStatsGrid from '$lib/features/library/components/LibraryStatsGrid/LibraryStatsGrid.svelte';
	import LibraryToolbar from '$lib/features/library/components/LibraryToolbar/LibraryToolbar.svelte';
	import TrashBookCard from '$lib/features/library/components/TrashBookCard/TrashBookCard.svelte';
	import {
		DEFAULT_LIBRARY_SORT_PREFERENCE,
		applyBulkShelfSelection,
		getVisibleBookIds,
		getBookStatus,
		groupBooksBySeries,
		isSeriesSortPreference,
		matchesBookQuery,
		matchesBookShelf,
		matchesBookStatus,
		parseNullableNumber,
		parseViewFromUrl,
		pruneBookSelection,
		readStoredLibrarySort,
		sortBooks,
		toggleBookSelection,
		toDraftText,
		type DetailTab,
		type LibraryBookGroup,
		type LibraryBulkShelfAction,
		type LibrarySortDirection,
		type LibrarySortField,
		type LibrarySortPreference,
		type LibraryStatusFilter,
		type LibraryView,
		type LibraryVisualMode,
		type MetadataDraft,
		writeStoredLibrarySort
	} from '$lib/features/library/libraryView';
	import type { ApiError } from '$lib/types/ApiError';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import type { BookProgressHistoryEntry } from '$lib/types/Library/BookProgressHistory';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import styles from './page.module.scss';

	let books = $state<LibraryBook[]>([]);
	let shelves = $state<LibraryShelf[]>([]);
	let trashBooks = $state<LibraryBook[]>([]);
	let isLoading = $state(true);
	let error = $state<ApiError | null>(null);
	let sortPreference = $state<LibrarySortPreference>({ ...DEFAULT_LIBRARY_SORT_PREFERENCE });
	let currentView = $state<LibraryView>('library');
	let searchQuery = $state('');
	let statusFilter = $state<LibraryStatusFilter>('all');
	let visualMode = $state<LibraryVisualMode>('grid');
	let showFilters = $state(false);
	let showSortFieldMenu = $state(false);
	let showShelfAssign = $state<number | null>(null);
	let selectionMode = $state(false);
	let selectedBookIds = $state<number[]>([]);
	let showConfirmModal = $state(false);
	let bookToReset = $state<LibraryBook | null>(null);
	let showBulkTrashModal = $state(false);
	let showDetailModal = $state(false);
	let selectedBook = $state<LibraryBook | null>(null);
	let selectedBookDetail = $state<LibraryBookDetail | null>(null);
	let detailModalView = $state<LibraryView | null>(null);
	let activeDetailTab = $state<DetailTab>('overview');
	let isDetailLoading = $state(false);
	let isRefetchingMetadata = $state(false);
	let isProgressHistoryLoading = $state(false);
	let showProgressHistory = $state(false);
	let removingDeviceId = $state<string | null>(null);
	let isMovingToTrash = $state(false);
	let isDownloadingLibraryFile = $state(false);
	let isUploadingLibraryFile = $state(false);
	let isBulkActionPending = $state(false);
	let isLibraryDropActive = $state(false);
	let isUpdatingRating = $state(false);
	let isUpdatingReadState = $state(false);
	let isUpdatingArchiveState = $state(false);
	let isUpdatingNewBooksExclusion = $state(false);
	let isUpdatingShelves = $state(false);
	let isEditingMetadata = $state(false);
	let isSavingMetadata = $state(false);
	let isImportingCover = $state(false);
	let restoringBookId = $state<number | null>(null);
	let deletingTrashBookId = $state<number | null>(null);
	let pendingDeleteTrashBook = $state<LibraryBook | null>(null);
	let showDeleteTrashModal = $state(false);
	let detailError = $state<string | null>(null);
	let progressHistoryError = $state<string | null>(null);
	let progressHistory = $state<BookProgressHistoryEntry[]>([]);
	let metadataDraft = $state<MetadataDraft>({
		title: '',
		author: '',
		publisher: '',
		series: '',
		seriesIndex: '',
		volume: '',
		edition: '',
		identifier: '',
		pages: '',
		description: '',
		cover: '',
		language: '',
		year: '',
		month: '',
		day: '',
		googleBooksId: '',
		openLibraryKey: '',
		amazonAsin: '',
		externalRating: '',
		externalRatingCount: ''
	});
	let libraryDropDepth = 0;
	let hasInitializedSortPreference = $state(false);

	let activeLibraryBooks = $derived(books.filter((book) => !book.archived_at));
	let archivedBooks = $derived(books.filter((book) => Boolean(book.archived_at)));
	let sortedBooks = $derived(sortBooks(activeLibraryBooks, sortPreference));
	let sortedArchivedBooks = $derived(sortBooks(archivedBooks, sortPreference));
	let shelvesById = $derived(new Map(shelves.map((shelf) => [shelf.id, shelf] as const)));
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
	let shelfScopedLibraryBooks = $derived(
		selectedShelfId === null
			? sortedBooks
			: sortedBooks.filter((book) => matchesBookShelf(book, selectedShelfId, shelvesById))
	);
	let filteredLibraryBooks = $derived(
		sortedBooks.filter(
			(book) =>
				matchesBookQuery(book, searchQuery) &&
				matchesBookStatus(book, statusFilter) &&
				matchesBookShelf(book, selectedShelfId, shelvesById)
		)
	);
	let filteredArchivedBooks = $derived(
		sortedArchivedBooks.filter((book) => matchesBookQuery(book, searchQuery))
	);
	let filteredTrashBooks = $derived(
		trashBooks.filter((book) => matchesBookQuery(book, searchQuery))
	);
	let visibleBooks = $derived(currentView === 'library' ? filteredLibraryBooks : filteredArchivedBooks);
	let visibleBookGroups = $derived.by<LibraryBookGroup[]>(() =>
		isSeriesSortPreference(sortPreference) ? groupBooksBySeries(visibleBooks) : []
	);
	let visibleLibraryBookIds = $derived(getVisibleBookIds(filteredLibraryBooks));
	let selectedBooks = $derived(
		filteredLibraryBooks.filter((book) => selectedBookIds.includes(book.id))
	);
	let allVisibleLibraryBooksSelected = $derived(
		visibleLibraryBookIds.length > 0 && selectedBookIds.length === visibleLibraryBookIds.length
	);
	let libraryStats = $derived({
		total: shelfScopedLibraryBooks.length,
		reading: shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === 'reading').length,
		unread: shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === 'unread').length,
		read: shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === 'read').length
	});

	$effect(() => {
		if (currentView !== 'library') {
			if (selectionMode) {
				selectionMode = false;
			}
			if (selectedBookIds.length > 0) {
				selectedBookIds = [];
			}
			showBulkTrashModal = false;
			return;
		}

		if (!selectionMode) {
			if (selectedBookIds.length > 0) {
				selectedBookIds = [];
			}
			showBulkTrashModal = false;
			return;
		}

		showShelfAssign = null;
		const nextSelectedBookIds = pruneBookSelection(selectedBookIds, visibleLibraryBookIds);
		if (
			nextSelectedBookIds.length !== selectedBookIds.length ||
			nextSelectedBookIds.some((id, index) => id !== selectedBookIds[index])
		) {
			selectedBookIds = nextSelectedBookIds;
		}
	});

	$effect(() => {
		if (!hasInitializedSortPreference || typeof localStorage === 'undefined' || currentView !== 'library') {
			return;
		}

		sortPreference =
			readStoredLibrarySort(localStorage, selectedShelfId) ?? { ...DEFAULT_LIBRARY_SORT_PREFERENCE };
	});

	onMount(() => {
		const handleShelvesChanged = () => {
			void loadShelves();
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('shelves:changed', handleShelvesChanged);
		}

		(async () => {
			if (typeof localStorage !== 'undefined') {
				sortPreference =
					readStoredLibrarySort(localStorage, selectedShelfId) ?? { ...DEFAULT_LIBRARY_SORT_PREFERENCE };
			}
			hasInitializedSortPreference = true;

			const params = new URLSearchParams(window.location.search);
			const requestedView = parseViewFromUrl(params.get('view'));
			const openBookIdParam = params.get('openBookId');
			const openBookId = openBookIdParam ? Number.parseInt(openBookIdParam, 10) : NaN;

			if (requestedView === 'archived') {
				const archivedTarget = Number.isNaN(openBookId)
					? '/archived'
					: `/archived?openBookId=${openBookId}`;
				await goto(archivedTarget, { replaceState: true });
				return;
			}

			if (requestedView === 'trash') {
				await goto('/trash', { replaceState: true });
				return;
			}

			if (requestedView === 'library') {
				currentView = 'library';
			}

			if (currentView === 'trash') {
				await loadTrash();
				return;
			}

			await loadLibrary();
			await loadShelves();

			if (!Number.isNaN(openBookId)) {
				const candidate = books.find(
					(book) =>
						book.id === openBookId &&
						(currentView !== 'archived' || Boolean(book.archived_at))
				);
				if (candidate) {
					await openDetailModal(candidate);
				}
			}
		})();

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('shelves:changed', handleShelvesChanged);
			}
		};
	});

	function updateLibraryUrl(openBookId?: number | null): void {
		if (typeof window === 'undefined') {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		params.delete('view');
		if (typeof openBookId === 'number') {
			params.set('openBookId', String(openBookId));
		} else {
			params.delete('openBookId');
		}

		const query = params.toString();
		const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
		window.history.replaceState(window.history.state, '', next);
	}

	async function loadLibrary(): Promise<void> {
		isLoading = true;
		error = null;
		const result = await ZUI.getLibrary();
		if (result.ok) {
			books = result.value.books;
		} else {
			error = result.error;
		}
		isLoading = false;
	}

	async function loadShelves(): Promise<void> {
		const result = await ZUI.getLibraryShelves();
		if (!result.ok) {
			toastStore.add(`Failed to load shelves: ${result.error.message}`, 'error');
			return;
		}

		shelves = result.value.shelves;
		if (selectedShelfId !== null && !shelves.some((shelf) => shelf.id === selectedShelfId)) {
			updateShelfUrl(null);
		}
	}

	function updateShelfUrl(shelfId: number | null): void {
		if (typeof window === 'undefined') {
			return;
		}
		const params = new URLSearchParams(window.location.search);
		if (shelfId === null) {
			params.delete('shelf');
		} else {
			params.set('shelf', String(shelfId));
		}
		const query = params.toString();
		const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
		window.history.replaceState(window.history.state, '', next);
	}

	async function loadTrash(): Promise<void> {
		isLoading = true;
		error = null;
		const result = await ZUI.getLibraryTrash();
		if (result.ok) {
			trashBooks = result.value.books;
		} else {
			error = result.error;
		}
		isLoading = false;
	}

	function disableSelectionMode(): void {
		selectionMode = false;
		selectedBookIds = [];
		showShelfAssign = null;
		showBulkTrashModal = false;
	}

	function startSelectionModeFromBook(book: LibraryBook): void {
		if (isBulkActionPending) {
			return;
		}

		selectionMode = true;
		selectedBookIds = [book.id];
		showShelfAssign = null;
		showBulkTrashModal = false;
	}

	function clearSelectedBooks(): void {
		if (isBulkActionPending) {
			return;
		}

		selectedBookIds = [];
	}

	function selectAllVisibleBooks(): void {
		if (isBulkActionPending || filteredLibraryBooks.length === 0) {
			return;
		}

		selectedBookIds = allVisibleLibraryBooksSelected ? [] : visibleLibraryBookIds;
	}

	function handleToggleSelectedBook(book: LibraryBook): void {
		if (isBulkActionPending) {
			return;
		}

		selectedBookIds = toggleBookSelection(selectedBookIds, book.id);
	}

	function getSelectedBooksOrToast(): LibraryBook[] {
		if (selectedBooks.length === 0) {
			toastStore.add('Select at least one visible book first', 'error');
			return [];
		}

		return selectedBooks;
	}

	function formatBulkFailureSummary(
		actionLabel: string,
		failures: Array<{ book: LibraryBook; message: string }>
	): string {
		const firstFailure = failures[0];
		if (!firstFailure) {
			return `Failed to ${actionLabel}`;
		}

		if (failures.length === 1) {
			return `Failed to ${actionLabel} "${firstFailure.book.title}": ${firstFailure.message}`;
		}

		return `Failed to ${actionLabel} ${failures.length} books. First error: "${firstFailure.book.title}" (${firstFailure.message})`;
	}

	async function executeBulkBookAction(options: {
		actionLabel: string;
		successMessage: (successCount: number) => string;
		targetBooks: LibraryBook[];
		reloadTrash?: boolean;
		run: (
			book: LibraryBook
		) => Promise<{ ok: true } | { ok: false; message: string }>;
	}): Promise<void> {
		if (options.targetBooks.length === 0 || isBulkActionPending) {
			return;
		}

		isBulkActionPending = true;
		showBulkTrashModal = false;

		try {
			const outcomes: Array<
				| { book: LibraryBook; ok: true }
				| { book: LibraryBook; ok: false; message: string }
			> = [];
			for (const book of options.targetBooks) {
				const outcome = await options.run(book);
				outcomes.push({
					book,
					...outcome
				});
			}

			const successCount = outcomes.filter((outcome) => outcome.ok).length;
			const failures = outcomes
				.filter((outcome): outcome is { book: LibraryBook; ok: false; message: string } => !outcome.ok)
				.map((outcome) => ({ book: outcome.book, message: outcome.message }));

			if (successCount > 0) {
				await loadLibrary();
				if (options.reloadTrash) {
					await loadTrash();
				}
				toastStore.add(options.successMessage(successCount), 'success');
			}

			if (failures.length > 0) {
				toastStore.add(
					formatBulkFailureSummary(options.actionLabel, failures),
					'error',
					5000
				);
			}
		} finally {
			isBulkActionPending = false;
		}
	}

	function openResetModal(book: LibraryBook): void {
		bookToReset = book;
		showConfirmModal = true;
	}

	function closeResetModal(): void {
		showConfirmModal = false;
		bookToReset = null;
	}

	async function openDetailModal(book: LibraryBook): Promise<void> {
		await loadShelves();
		detailModalView = currentView;
		updateLibraryUrl(book.id);
		selectedBook = book;
		selectedBookDetail = null;
		activeDetailTab = 'overview';
		detailError = null;
		progressHistoryError = null;
		progressHistory = [];
		showProgressHistory = false;
		isEditingMetadata = false;
		showDetailModal = true;
		isDetailLoading = true;

		const result = await ZUI.getLibraryBookDetail(book.id);
		if (result.ok) {
			selectedBookDetail = result.value;
			initializeMetadataDraft(result.value);
			await loadProgressHistory(book.id);
		} else {
			detailError = result.error.message;
		}

		isDetailLoading = false;
	}

	function closeDetailModal(): void {
		if (isMovingToTrash) {
			return;
		}

		const nextView = detailModalView ?? currentView;
		currentView = nextView;
		updateLibraryUrl(null);
		showDetailModal = false;
		selectedBook = null;
		selectedBookDetail = null;
		detailModalView = null;
		detailError = null;
		isDetailLoading = false;
		isProgressHistoryLoading = false;
		isRefetchingMetadata = false;
		removingDeviceId = null;
		isMovingToTrash = false;
		isDownloadingLibraryFile = false;
		isUpdatingRating = false;
		isUpdatingReadState = false;
		isUpdatingArchiveState = false;
		isUpdatingNewBooksExclusion = false;
		isUpdatingShelves = false;
		isEditingMetadata = false;
		isSavingMetadata = false;
		isImportingCover = false;
		progressHistoryError = null;
		progressHistory = [];
		showProgressHistory = false;
		activeDetailTab = 'overview';
	}

	async function loadProgressHistory(bookId: number): Promise<void> {
		isProgressHistoryLoading = true;
		progressHistoryError = null;
		const result = await ZUI.getLibraryBookProgressHistory(bookId);
		isProgressHistoryLoading = false;
		if (!result.ok) {
			progressHistoryError = result.error.message;
			progressHistory = [];
			return;
		}
		progressHistory = result.value.history;
	}

	function initializeMetadataDraft(detail: LibraryBookDetail): void {
		metadataDraft = {
			title: toDraftText(detail.title),
			author: toDraftText(detail.author),
			publisher: toDraftText(detail.publisher),
			series: toDraftText(detail.series),
			seriesIndex: toDraftText(detail.seriesIndex),
			volume: toDraftText(detail.volume),
			edition: toDraftText(detail.edition),
			identifier: toDraftText(detail.identifier),
			pages: toDraftText(detail.pages),
			description: toDraftText(detail.description),
			cover: toDraftText(selectedBook?.cover ?? ''),
			language: toDraftText(selectedBook?.language ?? ''),
			year: toDraftText(detail.year),
			month: toDraftText(detail.month),
			day: toDraftText(detail.day),
			googleBooksId: toDraftText(detail.googleBooksId),
			openLibraryKey: toDraftText(detail.openLibraryKey),
			amazonAsin: toDraftText(detail.amazonAsin),
			externalRating: toDraftText(detail.externalRating),
			externalRatingCount: toDraftText(detail.externalRatingCount)
		};
	}

	function openResetFromDetail(): void {
		if (!selectedBook) {
			return;
		}
		const targetBook = selectedBook;
		closeDetailModal();
		openResetModal(targetBook);
	}

	function applyBookMetadataUpdate(updated: {
		id: number;
		zLibId: string | null;
		title: string;
		author: string | null;
		publisher: string | null;
		series: string | null;
		seriesIndex: number | null;
		volume: string | null;
		edition: string | null;
		identifier: string | null;
		pages: number | null;
		description: string | null;
		googleBooksId: string | null;
		openLibraryKey: string | null;
		amazonAsin: string | null;
		externalRating: number | null;
		externalRatingCount: number | null;
		cover: string | null;
		extension: string | null;
		filesize: number | null;
		language: string | null;
		year: number | null;
		month: number | null;
		day: number | null;
	}): void {
		const index = books.findIndex((book) => book.id === updated.id);
		if (index === -1) {
			return;
		}

		const updatedBook: LibraryBook = {
			...books[index],
			zLibId: updated.zLibId,
			title: updated.title,
			author: updated.author,
			publisher: updated.publisher,
			series: updated.series,
			series_index: updated.seriesIndex,
			volume: updated.volume,
			edition: updated.edition,
			identifier: updated.identifier,
			pages: updated.pages,
			description: updated.description,
			google_books_id: updated.googleBooksId,
			open_library_key: updated.openLibraryKey,
			amazon_asin: updated.amazonAsin,
			external_rating: updated.externalRating,
			external_rating_count: updated.externalRatingCount,
			cover: updated.cover,
			extension: updated.extension,
			filesize: updated.filesize,
			language: updated.language,
			year: updated.year,
			month: updated.month,
			day: updated.day
		};

		books = [...books.slice(0, index), updatedBook, ...books.slice(index + 1)];
		selectedBook = updatedBook;
	}

	async function handleRefetchMetadata(): Promise<void> {
		if (!selectedBook || isRefetchingMetadata) {
			return;
		}

		isRefetchingMetadata = true;
		const result = await ZUI.refetchLibraryBookMetadata(selectedBook.id);
		isRefetchingMetadata = false;

		if (!result.ok) {
			detailError = result.error.message;
			toastStore.add(`Failed to refetch metadata: ${result.error.message}`, 'error');
			return;
		}

		applyBookMetadataUpdate(result.value.book);
		if (selectedBookDetail) {
			selectedBookDetail = {
				...selectedBookDetail,
				title: result.value.book.title,
				author: result.value.book.author,
				publisher: result.value.book.publisher,
				series: result.value.book.series,
				seriesIndex: result.value.book.seriesIndex,
				volume: result.value.book.volume,
				edition: result.value.book.edition,
				identifier: result.value.book.identifier,
				pages: result.value.book.pages,
				description: result.value.book.description,
				googleBooksId: result.value.book.googleBooksId,
				openLibraryKey: result.value.book.openLibraryKey,
				amazonAsin: result.value.book.amazonAsin,
				externalRating: result.value.book.externalRating,
				externalRatingCount: result.value.book.externalRatingCount,
				year: result.value.book.year,
				month: result.value.book.month,
				day: result.value.book.day
			};
			initializeMetadataDraft(selectedBookDetail);
		}
		detailError = null;
		toastStore.add('Book metadata refreshed', 'success');
	}

	function startMetadataEdit(): void {
		if (!selectedBookDetail) {
			return;
		}
		initializeMetadataDraft(selectedBookDetail);
		isEditingMetadata = true;
	}

	function cancelMetadataEdit(): void {
		isEditingMetadata = false;
		if (selectedBookDetail) {
			initializeMetadataDraft(selectedBookDetail);
		}
	}

	async function saveMetadataEdit(): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isSavingMetadata) {
			return;
		}

		const title = metadataDraft.title.trim();
		if (!title) {
			toastStore.add('Title cannot be empty', 'error');
			return;
		}

		const year = parseNullableNumber(metadataDraft.year);
		const month = parseNullableNumber(metadataDraft.month);
		const day = parseNullableNumber(metadataDraft.day);
		if (year === null && (month !== null || day !== null)) {
			toastStore.add('Published date month and day require a year', 'error');
			return;
		}
		if (month === null && day !== null) {
			toastStore.add('Published date day requires a month', 'error');
			return;
		}

		isSavingMetadata = true;
		const updateResult = await ZUI.updateLibraryBookMetadata(selectedBook.id, {
			title,
			author: metadataDraft.author.trim() || null,
			publisher: metadataDraft.publisher.trim() || null,
			series: metadataDraft.series.trim() || null,
			seriesIndex: parseNullableNumber(metadataDraft.seriesIndex),
			volume: metadataDraft.volume.trim() || null,
			edition: metadataDraft.edition.trim() || null,
			identifier: metadataDraft.identifier.trim() || null,
			pages: parseNullableNumber(metadataDraft.pages),
			description: metadataDraft.description.trim() || null,
			cover: metadataDraft.cover.trim() || null,
			language: metadataDraft.language.trim() || null,
			year,
			month: year === null ? null : month,
			day: year === null || month === null ? null : day,
			googleBooksId: metadataDraft.googleBooksId.trim() || null,
			openLibraryKey: metadataDraft.openLibraryKey.trim() || null,
			amazonAsin: metadataDraft.amazonAsin.trim() || null,
			externalRating: parseNullableNumber(metadataDraft.externalRating),
			externalRatingCount: parseNullableNumber(metadataDraft.externalRatingCount)
		});
		isSavingMetadata = false;

		if (!updateResult.ok) {
			toastStore.add(`Failed to save metadata: ${updateResult.error.message}`, 'error');
			return;
		}

		const detailResult = await ZUI.getLibraryBookDetail(selectedBook.id);
		if (detailResult.ok) {
			selectedBookDetail = detailResult.value;
			initializeMetadataDraft(detailResult.value);
		}

		await loadLibrary();
		isEditingMetadata = false;
		toastStore.add('Metadata updated', 'success');
	}

	function setBookDownloadedState(bookId: number, isDownloaded: boolean): void {
		const index = books.findIndex((book) => book.id === bookId);
		if (index === -1) {
			return;
		}
		const updatedBook: LibraryBook = {
			...books[index],
			isDownloaded
		};
		books = [...books.slice(0, index), updatedBook, ...books.slice(index + 1)];
		selectedBook = updatedBook;
	}

	function setBookRatingState(bookId: number, rating: number | null): void {
		const index = books.findIndex((book) => book.id === bookId);
		if (index !== -1) {
			const updatedBook: LibraryBook = {
				...books[index],
				rating
			};
			books = [...books.slice(0, index), updatedBook, ...books.slice(index + 1)];
			selectedBook = updatedBook;
		}

		if (selectedBookDetail) {
			selectedBookDetail = {
				...selectedBookDetail,
				rating
			};
		}
	}

	function setBookCoverState(bookId: number, cover: string | null): void {
		const index = books.findIndex((book) => book.id === bookId);
		if (index === -1) {
			return;
		}

		const updatedBook: LibraryBook = {
			...books[index],
			cover
		};
		books = [...books.slice(0, index), updatedBook, ...books.slice(index + 1)];
		selectedBook = updatedBook;
	}

	async function handleImportCover(): Promise<void> {
		if (!selectedBook || isImportingCover) {
			return;
		}

		const coverUrl = metadataDraft.cover.trim() || selectedBook.cover;
		if (!coverUrl) {
			toastStore.add('No cover URL available to import', 'error');
			return;
		}

		isImportingCover = true;
		const result = await ZUI.importLibraryBookCover(selectedBook.id, coverUrl);
		isImportingCover = false;

		if (!result.ok) {
			toastStore.add(`Failed to import cover: ${result.error.message}`, 'error');
			return;
		}

		setBookCoverState(selectedBook.id, result.value.cover);
		metadataDraft.cover = result.value.cover;
		toastStore.add('Cover stored internally', 'success');
	}

	async function handleSetRating(rating: number | null): Promise<void> {
		if (!selectedBook || isUpdatingRating) {
			return;
		}
		isUpdatingRating = true;
		const result = await ZUI.updateLibraryBookRating(selectedBook.id, rating);
		isUpdatingRating = false;
		if (!result.ok) {
			toastStore.add(`Failed to update rating: ${result.error.message}`, 'error');
			return;
		}
		setBookRatingState(selectedBook.id, result.value.rating);
		toastStore.add(
			result.value.rating === null
				? 'Rating cleared'
				: `Rating updated to ${result.value.rating} star${result.value.rating === 1 ? '' : 's'}`,
			'success'
		);
	}

	async function handleToggleReadState(): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isUpdatingReadState) {
			return;
		}
		const nextIsRead = !selectedBookDetail.isRead;
		isUpdatingReadState = true;
		const result = await ZUI.updateLibraryBookState(selectedBook.id, { isRead: nextIsRead });
		isUpdatingReadState = false;
		if (!result.ok) {
			toastStore.add(`Failed to update read state: ${result.error.message}`, 'error');
			return;
		}
		selectedBookDetail = {
			...selectedBookDetail,
			isRead: result.value.isRead,
			readAt: result.value.readAt,
			progressPercent:
				typeof result.value.progressPercent === 'number'
					? Math.max(0, Math.min(100, result.value.progressPercent * 100))
					: null
		};
		toastStore.add(result.value.isRead ? 'Marked as read' : 'Marked as unread', 'success');
	}

	async function handleToggleExcludeFromNewBooks(): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isUpdatingNewBooksExclusion) {
			return;
		}
		const nextValue = !selectedBookDetail.excludeFromNewBooks;
		isUpdatingNewBooksExclusion = true;
		const result = await ZUI.updateLibraryBookState(selectedBook.id, { excludeFromNewBooks: nextValue });
		isUpdatingNewBooksExclusion = false;
		if (!result.ok) {
			toastStore.add(`Failed to update new-books exclusion: ${result.error.message}`, 'error');
			return;
		}
		selectedBookDetail = {
			...selectedBookDetail,
			excludeFromNewBooks: result.value.excludeFromNewBooks
		};
		toastStore.add(
			result.value.excludeFromNewBooks
				? 'Book excluded from new-books API'
				: 'Book included in new-books API',
			'success'
		);
	}

	async function handleToggleArchiveState(): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isUpdatingArchiveState) {
			return;
		}
		const targetBook = selectedBook;
		const nextArchived = !selectedBookDetail.isArchived;
		isUpdatingArchiveState = true;
		const result = await ZUI.updateLibraryBookState(targetBook.id, { archived: nextArchived });
		isUpdatingArchiveState = false;
		if (!result.ok) {
			toastStore.add(`Failed to update archive state: ${result.error.message}`, 'error');
			return;
		}
		selectedBookDetail = {
			...selectedBookDetail,
			isArchived: result.value.isArchived,
			archivedAt: result.value.archivedAt,
			excludeFromNewBooks: result.value.excludeFromNewBooks
		};
		const index = books.findIndex((book) => book.id === targetBook.id);
		if (index !== -1) {
			const updatedBook: LibraryBook = {
				...books[index],
				archived_at: result.value.archivedAt,
				exclude_from_new_books: result.value.excludeFromNewBooks
			};
			books = [...books.slice(0, index), updatedBook, ...books.slice(index + 1)];
			selectedBook = updatedBook;
		}
		toastStore.add(
			result.value.isArchived
				? 'Book archived (it will no longer appear in New Books API)'
				: 'Book unarchived',
			'success'
		);
	}

	async function handleRemoveDeviceDownload(deviceId: string): Promise<void> {
		if (!selectedBook || !selectedBookDetail || removingDeviceId) {
			return;
		}
		removingDeviceId = deviceId;
		const result = await ZUI.removeLibraryBookDeviceDownload(selectedBook.id, deviceId);
		removingDeviceId = null;
		if (!result.ok) {
			toastStore.add(`Failed to remove device download: ${result.error.message}`, 'error');
			return;
		}
		const remaining = selectedBookDetail.downloadedDevices.filter((item) => item !== deviceId);
		selectedBookDetail = {
			...selectedBookDetail,
			downloadedDevices: remaining
		};
		setBookDownloadedState(selectedBook.id, remaining.length > 0);
		toastStore.add(`Removed download for device "${deviceId}"`, 'success');
	}

	async function handleMoveToTrash(): Promise<void> {
		if (!selectedBook || isMovingToTrash) {
			return;
		}
		const targetBook = selectedBook;
		isMovingToTrash = true;
		const result = await ZUI.moveLibraryBookToTrash(targetBook.id);
		isMovingToTrash = false;
		if (!result.ok) {
			toastStore.add(`Failed to move book to trash: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Moved "${targetBook.title}" to trash`, 'success');
		closeDetailModal();
		await loadLibrary();
		await loadTrash();
	}

	function buildLibraryDownloadName(book: LibraryBook): string {
		const rawTitle = (book.title || 'book').trim();
		const title = rawTitle.length > 0 ? rawTitle : 'book';
		const extension = book.extension?.trim().toLowerCase();
		if (!extension) {
			return title;
		}
		return title.toLowerCase().endsWith(`.${extension}`) ? title : `${title}.${extension}`;
	}

	async function handleDownloadFromLibrary(): Promise<void> {
		if (!selectedBook || isDownloadingLibraryFile) {
			return;
		}
		const targetBook = selectedBook;
		isDownloadingLibraryFile = true;
		const result = await ZUI.downloadLibraryBookFile(
			targetBook.s3_storage_key,
			buildLibraryDownloadName(targetBook)
		);
		isDownloadingLibraryFile = false;
		if (!result.ok) {
			toastStore.add(`Failed to download from library: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Downloaded "${targetBook.title}"`, 'success');
	}

	async function handleRestoreBook(book: LibraryBook): Promise<void> {
		if (restoringBookId !== null || deletingTrashBookId !== null) {
			return;
		}
		restoringBookId = book.id;
		const result = await ZUI.restoreLibraryBook(book.id);
		restoringBookId = null;
		if (!result.ok) {
			toastStore.add(`Failed to restore book: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Restored "${book.title}"`, 'success');
		await loadLibrary();
		await loadTrash();
	}

	function requestDeleteTrashedBook(book: LibraryBook): void {
		pendingDeleteTrashBook = book;
		showDeleteTrashModal = true;
	}

	function cancelDeleteTrashedBook(): void {
		if (deletingTrashBookId !== null) {
			return;
		}
		showDeleteTrashModal = false;
		pendingDeleteTrashBook = null;
	}

	async function confirmDeleteTrashedBook(): Promise<void> {
		const book = pendingDeleteTrashBook;
		if (!book) {
			return;
		}
		if (restoringBookId !== null || deletingTrashBookId !== null) {
			return;
		}
		deletingTrashBookId = book.id;
		const result = await ZUI.deleteTrashedLibraryBook(book.id);
		deletingTrashBookId = null;
		if (!result.ok) {
			toastStore.add(`Failed to delete permanently: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Deleted "${book.title}" permanently`, 'success');
		await loadLibrary();
		await loadTrash();
		showDeleteTrashModal = false;
		pendingDeleteTrashBook = null;
	}

	function isFileDragEvent(event: DragEvent): boolean {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

	function resetLibraryDropState(): void {
		libraryDropDepth = 0;
		isLibraryDropActive = false;
	}

	function formatUploadFailureSummary(
		failures: Array<{ fileName: string; message: string }>
	): string {
		const firstFailure = failures[0];
		if (!firstFailure) {
			return 'Upload failed';
		}
		if (failures.length === 1) {
			return `Failed to upload "${firstFailure.fileName}": ${firstFailure.message}`;
		}
		return `Failed to upload ${failures.length} books. First error: "${firstFailure.fileName}" (${firstFailure.message})`;
	}

	async function uploadLibraryFiles(files: File[]): Promise<void> {
		if (files.length === 0 || isUploadingLibraryFile) {
			return;
		}

		resetLibraryDropState();
		isUploadingLibraryFile = true;
		const uploadedFiles: string[] = [];
		const failedFiles: Array<{ fileName: string; message: string }> = [];

		for (const file of files) {
			const result = await ZUI.uploadLibraryBookFile(file);
			if (result.ok) {
				uploadedFiles.push(file.name);
				continue;
			}
			failedFiles.push({
				fileName: file.name,
				message: result.error.message
			});
		}

		isUploadingLibraryFile = false;

		if (uploadedFiles.length > 0) {
			if (uploadedFiles.length === 1 && failedFiles.length === 0) {
				toastStore.add(`Uploaded "${uploadedFiles[0]}"`, 'success');
			} else if (failedFiles.length === 0) {
				toastStore.add(`Uploaded ${uploadedFiles.length} books`, 'success');
			} else {
				toastStore.add(`Uploaded ${uploadedFiles.length} of ${files.length} books`, 'success');
			}
			await loadLibrary();
		}

		if (failedFiles.length > 0) {
			toastStore.add(formatUploadFailureSummary(failedFiles), 'error', 5000);
		}
	}

	async function handleLibraryUploadChange(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		await uploadLibraryFiles(files);
	}

	function handleLibraryDragEnter(event: DragEvent): void {
		if (currentView !== 'library' || isUploadingLibraryFile || !isFileDragEvent(event)) {
			return;
		}
		event.preventDefault();
		libraryDropDepth += 1;
		isLibraryDropActive = true;
	}

	function handleLibraryDragOver(event: DragEvent): void {
		if (currentView !== 'library' || !isFileDragEvent(event)) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = isUploadingLibraryFile ? 'none' : 'copy';
		}
	}

	function handleLibraryDragLeave(event: DragEvent): void {
		if (currentView !== 'library' || !isFileDragEvent(event)) {
			return;
		}
		event.preventDefault();
		libraryDropDepth = Math.max(0, libraryDropDepth - 1);
		if (libraryDropDepth === 0) {
			isLibraryDropActive = false;
		}
	}

	async function handleLibraryDrop(event: DragEvent): Promise<void> {
		if (currentView !== 'library' || !isFileDragEvent(event)) {
			return;
		}
		event.preventDefault();
		const files = Array.from(event.dataTransfer?.files ?? []);
		resetLibraryDropState();
		await uploadLibraryFiles(files);
	}

	async function confirmResetStatus(): Promise<void> {
		if (!bookToReset) {
			return;
		}
		const book = bookToReset;
		closeResetModal();
		const originalStatus = book.isDownloaded;
		const index = books.findIndex((b) => b.id === book.id);
		if (index !== -1) {
			const updatedBooks = [...books];
			updatedBooks[index] = { ...updatedBooks[index], isDownloaded: false };
			books = updatedBooks;
		}
		const result = await ZUI.resetDownloadStatus(book.id);
		if (!result.ok) {
			const revertIndex = books.findIndex((b) => b.id === book.id);
			if (revertIndex !== -1) {
				const updatedBooks = [...books];
				updatedBooks[revertIndex] = {
					...updatedBooks[revertIndex],
					isDownloaded: originalStatus
				};
				books = updatedBooks;
			}
			toastStore.add(`Failed to reset status: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Reset download status for "${book.title}"`, 'success');
	}

	function areNumberListsEqual(left: number[], right: number[]): boolean {
		return left.length === right.length && left.every((value, index) => value === right[index]);
	}

	async function handleBulkArchiveSelected(): Promise<void> {
		const targetBooks = getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await executeBulkBookAction({
			actionLabel: 'archive',
			targetBooks,
			successMessage: (successCount) =>
				`Archived ${successCount} book${successCount === 1 ? '' : 's'}`,
			run: async (book) => {
				const result = await ZUI.updateLibraryBookState(book.id, { archived: true });
				return result.ok ? { ok: true } : { ok: false, message: result.error.message };
			}
		});
	}

	async function handleBulkMarkReadSelected(): Promise<void> {
		const targetBooks = getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await executeBulkBookAction({
			actionLabel: 'mark as read',
			targetBooks,
			successMessage: (successCount) =>
				`Marked ${successCount} book${successCount === 1 ? '' : 's'} as read`,
			run: async (book) => {
				const result = await ZUI.updateLibraryBookState(book.id, { isRead: true });
				return result.ok ? { ok: true } : { ok: false, message: result.error.message };
			}
		});
	}

	async function handleBulkMarkUnreadSelected(): Promise<void> {
		const targetBooks = getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await executeBulkBookAction({
			actionLabel: 'mark as unread',
			targetBooks,
			successMessage: (successCount) =>
				`Marked ${successCount} book${successCount === 1 ? '' : 's'} as unread`,
			run: async (book) => {
				const result = await ZUI.updateLibraryBookState(book.id, { isRead: false });
				return result.ok ? { ok: true } : { ok: false, message: result.error.message };
			}
		});
	}

	function requestBulkMoveToTrash(): void {
		if (selectedBooks.length === 0 || isBulkActionPending) {
			return;
		}

		showBulkTrashModal = true;
	}

	function cancelBulkMoveToTrash(): void {
		if (isBulkActionPending) {
			return;
		}

		showBulkTrashModal = false;
	}

	async function confirmBulkMoveToTrash(): Promise<void> {
		const targetBooks = getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			showBulkTrashModal = false;
			return;
		}

		await executeBulkBookAction({
			actionLabel: 'move to trash',
			targetBooks,
			reloadTrash: true,
			successMessage: (successCount) =>
				`Moved ${successCount} book${successCount === 1 ? '' : 's'} to trash`,
			run: async (book) => {
				const result = await ZUI.moveLibraryBookToTrash(book.id);
				return result.ok ? { ok: true } : { ok: false, message: result.error.message };
			}
		});
	}

	async function handleBulkResetDownloadsSelected(): Promise<void> {
		const targetBooks = getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await executeBulkBookAction({
			actionLabel: 'reset download status for',
			targetBooks,
			successMessage: (successCount) =>
				`Reset download status for ${successCount} book${successCount === 1 ? '' : 's'}`,
			run: async (book) => {
				const result = await ZUI.resetDownloadStatus(book.id);
				return result.ok ? { ok: true } : { ok: false, message: result.error.message };
			}
		});
	}

	async function handleBulkShelfSelection(
		shelfId: number,
		action: LibraryBulkShelfAction
	): Promise<void> {
		const requestedBooks = getSelectedBooksOrToast();
		if (requestedBooks.length === 0) {
			return;
		}

		const shelf = shelves.find((candidate) => candidate.id === shelfId);
		const shelfLabel = shelf ? `"${shelf.name}"` : 'the selected shelf';
		const actionVerb = action === 'add' ? 'add to shelf' : 'remove from shelf';
		const successVerb = action === 'add' ? 'Added' : 'Removed';
		const targetBooks = requestedBooks.filter((book) => {
			const nextShelfIds = applyBulkShelfSelection(book.shelfIds, shelfId, action);
			const currentShelfIds = [...new Set(book.shelfIds)].sort((a, b) => a - b);
			return !areNumberListsEqual(nextShelfIds, currentShelfIds);
		});

		if (targetBooks.length === 0) {
			toastStore.add(
				action === 'add'
					? `Selected books are already on ${shelfLabel}`
					: `Selected books are not on ${shelfLabel}`,
				'error'
			);
			return;
		}

		await executeBulkBookAction({
			actionLabel: `${actionVerb}`,
			targetBooks,
			successMessage: (successCount) =>
				`${successVerb} ${successCount} book${successCount === 1 ? '' : 's'} ${action === 'add' ? 'to' : 'from'} ${shelfLabel}`,
			run: async (book) => {
				const nextShelfIds = applyBulkShelfSelection(book.shelfIds, shelfId, action);
				const result = await ZUI.setLibraryBookShelves(book.id, nextShelfIds);
				return result.ok ? { ok: true } : { ok: false, message: result.error.message };
			}
		});
	}

	function setBookShelfIdsState(bookId: number, shelfIds: number[]): void {
		const normalized = [...new Set(shelfIds)].sort((a, b) => a - b);
		const index = books.findIndex((book) => book.id === bookId);
		if (index !== -1) {
			const updatedBook: LibraryBook = {
				...books[index],
				shelfIds: normalized
			};
			books = [...books.slice(0, index), updatedBook, ...books.slice(index + 1)];
			if (selectedBook?.id === bookId) {
				selectedBook = updatedBook;
			}
		}

		if (selectedBookDetail && selectedBookDetail.bookId === bookId) {
			selectedBookDetail = {
				...selectedBookDetail,
				shelfIds: normalized
			};
		}
	}

	async function handleToggleBookShelf(bookId: number, shelfId: number): Promise<void> {
		if (isUpdatingShelves) {
			return;
		}
		const book = books.find((item) => item.id === bookId);
		if (!book) {
			return;
		}
		const currentIds = [...new Set(book.shelfIds)];
		const nextIds = currentIds.includes(shelfId)
			? currentIds.filter((id) => id !== shelfId)
			: [...currentIds, shelfId];
		isUpdatingShelves = true;
		const result = await ZUI.setLibraryBookShelves(bookId, nextIds);
		isUpdatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to update shelves: ${result.error.message}`, 'error');
			return;
		}
		setBookShelfIdsState(bookId, result.value.shelfIds);
	}

	async function handleToggleShelfAssignment(shelfId: number): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isUpdatingShelves) {
			return;
		}
		const currentIds = [...new Set(selectedBookDetail.shelfIds)];
		const nextIds = currentIds.includes(shelfId)
			? currentIds.filter((id) => id !== shelfId)
			: [...currentIds, shelfId];
		isUpdatingShelves = true;
		const result = await ZUI.setLibraryBookShelves(selectedBook.id, nextIds);
		isUpdatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to update shelves: ${result.error.message}`, 'error');
			return;
		}
		setBookShelfIdsState(selectedBook.id, result.value.shelfIds);
	}

	function setSortField(value: LibrarySortField): void {
		const nextSortPreference = { ...sortPreference, field: value };
		sortPreference = nextSortPreference;
		if (typeof localStorage !== 'undefined') {
			writeStoredLibrarySort(localStorage, selectedShelfId, nextSortPreference);
		}
	}

	function setSortDirection(value: LibrarySortDirection): void {
		showFilters = false;
		const nextSortPreference = { ...sortPreference, direction: value };
		sortPreference = nextSortPreference;
		if (typeof localStorage !== 'undefined') {
			writeStoredLibrarySort(localStorage, selectedShelfId, nextSortPreference);
		}
	}

	async function selectFilterOption(
		option: LibraryStatusFilter | 'archivedView' | 'trashView'
	): Promise<void> {
		showFilters = false;
		if (option === 'archivedView') {
			statusFilter = 'all';
			await goto('/archived');
			return;
		}
		if (option === 'trashView') {
			statusFilter = 'all';
			await goto('/trash');
			return;
		}
		if (currentView !== 'library') {
			await switchView('library');
		}
		statusFilter = option;
	}

	async function switchView(nextView: LibraryView): Promise<void> {
		if (currentView === nextView) {
			return;
		}
		resetLibraryDropState();
		showSortFieldMenu = false;
		showFilters = false;
		currentView = nextView;
		if (!showDetailModal) {
			updateLibraryUrl(null);
		}
		if (nextView === 'library' || nextView === 'archived') {
			await loadLibrary();
			return;
		}
		await loadTrash();
	}
</script>

<div
	class={`${styles.root} ${isLibraryDropActive ? styles.dragActive : ''} ${selectionMode ? styles.selectionActive : ''}`}
	role="region"
	aria-label="Library content"
	ondragenter={handleLibraryDragEnter}
	ondragover={handleLibraryDragOver}
	ondragleave={handleLibraryDragLeave}
	ondrop={handleLibraryDrop}
>
	<Loading bind:show={isLoading} />

	{#if isLibraryDropActive}
		<div class={styles.dropOverlay} aria-hidden="true">
			<div class={styles.dropPanel}>
				<p>Drop files to import them into your library</p>
				<span>Multiple files are supported.</span>
			</div>
		</div>
	{/if}

	{#if error}
		<div class={styles.error}>
			<AlertCircleIcon size={18} decorative={true} />
			<p>{error.message}</p>
			<button onclick={() => void loadLibrary()}>Retry</button>
		</div>
	{/if}

	{#if currentView === 'library'}
		<LibraryStatsGrid stats={libraryStats} />
	{/if}

	<LibraryToolbar
		{currentView}
		bind:searchQuery
		{statusFilter}
		{sortPreference}
		bind:visualMode
		bind:showFilters
		bind:showSortFieldMenu
		{isUploadingLibraryFile}
		onSetSortField={setSortField}
		onSetSortDirection={setSortDirection}
		onSelectFilterOption={selectFilterOption}
		onUploadChange={handleLibraryUploadChange}
	/>

	{#if currentView === 'library' && selectionMode}
		<LibraryBulkActionsBar
			selectedCount={selectedBookIds.length}
			visibleCount={filteredLibraryBooks.length}
			{shelves}
			isPending={isBulkActionPending}
			onDisableSelectionMode={disableSelectionMode}
			onSelectAllVisible={selectAllVisibleBooks}
			onClearSelection={clearSelectedBooks}
			onArchiveSelected={() => void handleBulkArchiveSelected()}
			onMarkReadSelected={() => void handleBulkMarkReadSelected()}
			onMarkUnreadSelected={() => void handleBulkMarkUnreadSelected()}
			onMoveToTrashSelected={requestBulkMoveToTrash}
			onResetDownloadsSelected={() => void handleBulkResetDownloadsSelected()}
			onAddSelectionToShelf={(shelfId) => void handleBulkShelfSelection(shelfId, 'add')}
			onRemoveSelectionFromShelf={(shelfId) => void handleBulkShelfSelection(shelfId, 'remove')}
		/>
	{/if}

	{#if currentView === 'trash'}
		{#if filteredTrashBooks.length > 0}
			<div class={styles.trashList}>
				{#each filteredTrashBooks as book (book.id)}
					<TrashBookCard
						{book}
						{restoringBookId}
						{deletingTrashBookId}
						onRestore={handleRestoreBook}
						onDelete={requestDeleteTrashedBook}
					/>
				{/each}
			</div>
		{:else if !isLoading}
			<LibraryEmptyState
				title="Trash is empty"
				description="Books moved to trash will appear here for 30 days."
			/>
		{/if}
	{:else}
		{#if visibleBooks.length > 0}
			{#if isSeriesSortPreference(sortPreference)}
				<div class={styles.seriesGroups}>
					{#each visibleBookGroups as group (group.id)}
						<section class={styles.seriesGroup} aria-label={`Series group ${group.label}`}>
							<div class={styles.seriesGroupHeader}>
								<h2>{group.label}</h2>
								<span class={styles.seriesGroupCount}>
									{group.books.length} book{group.books.length === 1 ? '' : 's'}
								</span>
							</div>
							{#if visualMode === 'grid'}
								<div class={styles.bookGrid}>
									{#each group.books as book (book.id)}
										<LibraryGridItem
											{book}
											{shelves}
											showShelfAssign={showShelfAssign === book.id}
											showShelfAssignControl={currentView === 'library' && !selectionMode}
											{selectionMode}
											selected={selectedBookIds.includes(book.id)}
											selectionDisabled={isBulkActionPending}
											onOpenDetail={openDetailModal}
											onStartSelectionMode={startSelectionModeFromBook}
											onToggleSelected={handleToggleSelectedBook}
											onToggleShelfAssignMenu={() => {
												showShelfAssign = showShelfAssign === book.id ? null : book.id;
											}}
											onCloseShelfAssignMenu={() => {
												showShelfAssign = null;
											}}
											onToggleBookShelf={(shelfId) => void handleToggleBookShelf(book.id, shelfId)}
										/>
									{/each}
								</div>
							{:else}
								<div class={styles.bookList}>
									{#each group.books as book (book.id)}
										<LibraryListItem
											{book}
											{shelves}
											showShelfAssign={showShelfAssign === book.id}
											showShelfAssignControl={currentView === 'library' && !selectionMode}
											{selectionMode}
											selected={selectedBookIds.includes(book.id)}
											selectionDisabled={isBulkActionPending}
											onOpenDetail={openDetailModal}
											onStartSelectionMode={startSelectionModeFromBook}
											onToggleSelected={handleToggleSelectedBook}
											onToggleShelfAssignMenu={() => {
												showShelfAssign = showShelfAssign === book.id ? null : book.id;
											}}
											onCloseShelfAssignMenu={() => {
												showShelfAssign = null;
											}}
											onToggleBookShelf={(shelfId) => void handleToggleBookShelf(book.id, shelfId)}
										/>
									{/each}
								</div>
							{/if}
						</section>
					{/each}
				</div>
			{:else if visualMode === 'grid'}
				<div class={styles.bookGrid}>
					{#each visibleBooks as book (book.id)}
						<LibraryGridItem
							{book}
							{shelves}
							showShelfAssign={showShelfAssign === book.id}
							showShelfAssignControl={currentView === 'library' && !selectionMode}
							{selectionMode}
							selected={selectedBookIds.includes(book.id)}
							selectionDisabled={isBulkActionPending}
							onOpenDetail={openDetailModal}
							onStartSelectionMode={startSelectionModeFromBook}
							onToggleSelected={handleToggleSelectedBook}
							onToggleShelfAssignMenu={() => {
								showShelfAssign = showShelfAssign === book.id ? null : book.id;
							}}
							onCloseShelfAssignMenu={() => {
								showShelfAssign = null;
							}}
							onToggleBookShelf={(shelfId) => void handleToggleBookShelf(book.id, shelfId)}
						/>
					{/each}
				</div>
			{:else}
				<div class={styles.bookList}>
					{#each visibleBooks as book (book.id)}
						<LibraryListItem
							{book}
							{shelves}
							showShelfAssign={showShelfAssign === book.id}
							showShelfAssignControl={currentView === 'library' && !selectionMode}
							{selectionMode}
							selected={selectedBookIds.includes(book.id)}
							selectionDisabled={isBulkActionPending}
							onOpenDetail={openDetailModal}
							onStartSelectionMode={startSelectionModeFromBook}
							onToggleSelected={handleToggleSelectedBook}
							onToggleShelfAssignMenu={() => {
								showShelfAssign = showShelfAssign === book.id ? null : book.id;
							}}
							onCloseShelfAssignMenu={() => {
								showShelfAssign = null;
							}}
							onToggleBookShelf={(shelfId) => void handleToggleBookShelf(book.id, shelfId)}
						/>
					{/each}
				</div>
			{/if}
		{:else if !isLoading}
			{#if currentView === 'library'}
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
	open={showDeleteTrashModal}
	title="Delete permanently?"
	message={`Delete "${pendingDeleteTrashBook?.title ?? 'this book'}" permanently? This removes it from the database and object storage.`}
	confirmLabel="Delete Permanently"
	cancelLabel="Cancel"
	danger={true}
	pending={deletingTrashBookId !== null}
	onConfirm={confirmDeleteTrashedBook}
	onCancel={cancelDeleteTrashedBook}
/>

<ConfirmModal
	open={showBulkTrashModal}
	title="Move selected books to trash?"
	message={`Move ${selectedBookIds.length} selected book${selectedBookIds.length === 1 ? '' : 's'} to trash? They will stay recoverable for 30 days.`}
	confirmLabel="Move To Trash"
	cancelLabel="Cancel"
	danger={true}
	pending={isBulkActionPending}
	onConfirm={confirmBulkMoveToTrash}
	onCancel={cancelBulkMoveToTrash}
/>

<ConfirmModal
	open={showConfirmModal && bookToReset !== null}
	title="Reset Download Status"
	message={`This will mark "${bookToReset?.title ?? 'this book'}" as not downloaded. The book will remain in your library; only the download status will be reset.`}
	confirmLabel="Reset Status"
	cancelLabel="Cancel"
	onConfirm={confirmResetStatus}
	onCancel={closeResetModal}
/>

{#if showDetailModal && selectedBook}
	<LibraryDetailModal
		{selectedBook}
		{selectedBookDetail}
		{shelves}
		bind:metadataDraft
		bind:activeDetailTab
		bind:showProgressHistory
		{isDetailLoading}
		detailError={detailError}
		{isRefetchingMetadata}
		{isProgressHistoryLoading}
		progressHistoryError={progressHistoryError}
		{progressHistory}
		{isMovingToTrash}
		{isDownloadingLibraryFile}
		{isUpdatingRating}
		{isUpdatingReadState}
		{isUpdatingArchiveState}
		{isUpdatingNewBooksExclusion}
		{isUpdatingShelves}
		{isEditingMetadata}
		{isSavingMetadata}
		{isImportingCover}
		{removingDeviceId}
		onClose={closeDetailModal}
		onRefetchMetadata={handleRefetchMetadata}
		onStartMetadataEdit={startMetadataEdit}
		onSaveMetadataEdit={saveMetadataEdit}
		onCancelMetadataEdit={cancelMetadataEdit}
		onImportCover={() => void handleImportCover()}
		onSetRating={handleSetRating}
		onToggleShelfAssignment={(shelfId) => void handleToggleShelfAssignment(shelfId)}
		onDownloadFromLibrary={handleDownloadFromLibrary}
		onToggleArchiveState={handleToggleArchiveState}
		onToggleExcludeFromNewBooks={handleToggleExcludeFromNewBooks}
		onToggleReadState={handleToggleReadState}
		onOpenReset={openResetFromDetail}
		onMoveToTrash={handleMoveToTrash}
		onRemoveDeviceDownload={(deviceId) => void handleRemoveDeviceDownload(deviceId)}
	/>
{/if}
