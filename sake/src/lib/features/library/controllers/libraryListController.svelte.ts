import { goto } from '$app/navigation';
import { shelfStore } from '$lib/client/stores/shelfStore.svelte';
import { toastStore } from '$lib/client/stores/toastStore.svelte';
import { ZUI } from '$lib/client/zui';
import {
	deleteTrashedLibraryBookAction,
	restoreLibraryBookAction
} from '$lib/features/library/libraryRouteActions';
import { replaceCurrentOpenBookId, replaceCurrentQueryParam } from '$lib/features/library/libraryRouteUrlState';
import {
	DEFAULT_LIBRARY_SORT_PREFERENCE,
	applyBulkShelfSelection,
	getBookStatus,
	getVisibleBookIds,
	groupBooksBySeries,
	isSeriesSortPreference,
	matchesBookQuery,
	matchesBookShelf,
	matchesBookStatus,
	pruneBookSelection,
	readStoredLibrarySort,
	sortBooks,
	toggleBookSelection,
	writeStoredLibrarySort,
	type LibraryBookGroup,
	type LibraryBulkShelfAction,
	type LibrarySortDirection,
	type LibrarySortField,
	type LibrarySortPreference,
	type LibraryStatusFilter,
	type LibraryView,
	type LibraryVisualMode
} from '$lib/features/library/libraryView';
import type { ApiError } from '$lib/types/ApiError';
import type { LibraryBook } from '$lib/types/Library/Book';

export interface LibraryMetadataUpdate {
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
	createdAt: string | null;
}

type BulkActionResult = { ok: true } | { ok: false; message: string };

export class LibraryListController {
	books = $state<LibraryBook[]>([]);
	trashBooks = $state<LibraryBook[]>([]);
	isLoading = $state(true);
	error = $state<ApiError | null>(null);
	sortPreference = $state<LibrarySortPreference>({ ...DEFAULT_LIBRARY_SORT_PREFERENCE });
	currentView = $state<LibraryView>('library');
	searchQuery = $state('');
	statusFilter = $state<LibraryStatusFilter>('all');
	visualMode = $state<LibraryVisualMode>('grid');
	showFilters = $state(false);
	showSortFieldMenu = $state(false);
	showShelfAssign = $state<number | null>(null);
	selectionMode = $state(false);
	selectedBookIds = $state<number[]>([]);
	showConfirmModal = $state(false);
	bookToReset = $state<LibraryBook | null>(null);
	showBulkTrashModal = $state(false);
	isBulkActionPending = $state(false);
	isUpdatingShelves = $state(false);
	restoringBookId = $state<number | null>(null);
	deletingTrashBookId = $state<number | null>(null);
	pendingDeleteTrashBook = $state<LibraryBook | null>(null);
	showDeleteTrashModal = $state(false);
	selectedShelfId = $state<number | null>(null);
	isDetailModalOpen = $state(false);
	hasInitializedSortPreference = $state(false);

	shelves = $derived(shelfStore.shelves);
	activeLibraryBooks = $derived(this.books.filter((book) => !book.archived_at));
	archivedBooks = $derived(this.books.filter((book) => Boolean(book.archived_at)));
	sortedBooks = $derived(sortBooks(this.activeLibraryBooks, this.sortPreference));
	sortedArchivedBooks = $derived(sortBooks(this.archivedBooks, this.sortPreference));
	shelvesById = $derived(new Map(this.shelves.map((shelf) => [shelf.id, shelf] as const)));
	shelfScopedLibraryBooks = $derived(
		this.selectedShelfId === null
			? this.sortedBooks
			: this.sortedBooks.filter((book) =>
					matchesBookShelf(book, this.selectedShelfId, this.shelvesById)
				)
	);
	filteredLibraryBooks = $derived(
		this.sortedBooks.filter(
			(book) =>
				matchesBookQuery(book, this.searchQuery) &&
				matchesBookStatus(book, this.statusFilter) &&
				matchesBookShelf(book, this.selectedShelfId, this.shelvesById)
		)
	);
	filteredArchivedBooks = $derived(
		this.sortedArchivedBooks.filter((book) => matchesBookQuery(book, this.searchQuery))
	);
	filteredTrashBooks = $derived(
		this.trashBooks.filter((book) => matchesBookQuery(book, this.searchQuery))
	);
	visibleBooks = $derived(
		this.currentView === 'library' ? this.filteredLibraryBooks : this.filteredArchivedBooks
	);
	visibleBookGroups = $derived.by<LibraryBookGroup[]>(() =>
		isSeriesSortPreference(this.sortPreference) ? groupBooksBySeries(this.visibleBooks) : []
	);
	visibleLibraryBookIds = $derived(getVisibleBookIds(this.filteredLibraryBooks));
	selectedBooks = $derived(
		this.filteredLibraryBooks.filter((book) => this.selectedBookIds.includes(book.id))
	);
	allVisibleLibraryBooksSelected = $derived(
		this.visibleLibraryBookIds.length > 0 &&
			this.selectedBookIds.length === this.visibleLibraryBookIds.length
	);
	libraryStats = $derived({
		total: this.shelfScopedLibraryBooks.length,
		reading: this.shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === 'reading')
			.length,
		unread: this.shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === 'unread')
			.length,
		read: this.shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === 'read').length
	});

	constructor() {
		$effect(() => {
			if (this.currentView !== 'library') {
				if (this.selectionMode) {
					this.selectionMode = false;
				}
				if (this.selectedBookIds.length > 0) {
					this.selectedBookIds = [];
				}
				this.showBulkTrashModal = false;
				return;
			}

			if (!this.selectionMode) {
				if (this.selectedBookIds.length > 0) {
					this.selectedBookIds = [];
				}
				this.showBulkTrashModal = false;
				return;
			}

			this.showShelfAssign = null;
			const nextSelectedBookIds = pruneBookSelection(
				this.selectedBookIds,
				this.visibleLibraryBookIds
			);
			if (
				nextSelectedBookIds.length !== this.selectedBookIds.length ||
				nextSelectedBookIds.some((id, index) => id !== this.selectedBookIds[index])
			) {
				this.selectedBookIds = nextSelectedBookIds;
			}
		});

		$effect(() => {
			if (
				!this.hasInitializedSortPreference ||
				typeof localStorage === 'undefined' ||
				this.currentView !== 'library'
			) {
				return;
			}

			this.sortPreference =
				readStoredLibrarySort(localStorage, this.selectedShelfId) ??
				{ ...DEFAULT_LIBRARY_SORT_PREFERENCE };
		});
	}

	initializeSortPreference(): void {
		if (typeof localStorage !== 'undefined') {
			this.sortPreference =
				readStoredLibrarySort(localStorage, this.selectedShelfId) ??
				{ ...DEFAULT_LIBRARY_SORT_PREFERENCE };
		}
		this.hasInitializedSortPreference = true;
	}

	updateLibraryUrl(openBookId?: number | null): void {
		replaceCurrentQueryParam('view', null);
		replaceCurrentOpenBookId(openBookId);
	}

	updateShelfUrl(shelfId: number | null): void {
		replaceCurrentQueryParam('shelf', shelfId);
	}

	async loadLibrary(): Promise<void> {
		this.isLoading = true;
		this.error = null;
		const result = await ZUI.getLibrary();
		if (result.ok) {
			this.books = result.value.books;
		} else {
			this.error = result.error;
		}
		this.isLoading = false;
	}

	async loadShelves(): Promise<void> {
		const result = await shelfStore.load();
		if (!result.ok) {
			toastStore.add(`Failed to load shelves: ${result.error.message}`, 'error');
			return;
		}

		if (
			this.selectedShelfId !== null &&
			!this.shelves.some((shelf) => shelf.id === this.selectedShelfId)
		) {
			this.updateShelfUrl(null);
		}
	}

	async loadTrash(): Promise<void> {
		this.isLoading = true;
		this.error = null;
		const result = await ZUI.getLibraryTrash();
		if (result.ok) {
			this.trashBooks = result.value.books;
		} else {
			this.error = result.error;
		}
		this.isLoading = false;
	}

	disableSelectionMode = (): void => {
		this.selectionMode = false;
		this.selectedBookIds = [];
		this.showShelfAssign = null;
		this.showBulkTrashModal = false;
	};

	startSelectionModeFromBook = (book: LibraryBook): void => {
		if (this.isBulkActionPending) {
			return;
		}

		this.selectionMode = true;
		this.selectedBookIds = [book.id];
		this.showShelfAssign = null;
		this.showBulkTrashModal = false;
	};

	clearSelectedBooks = (): void => {
		if (this.isBulkActionPending) {
			return;
		}

		this.selectedBookIds = [];
	};

	selectAllVisibleBooks = (): void => {
		if (this.isBulkActionPending || this.filteredLibraryBooks.length === 0) {
			return;
		}

		this.selectedBookIds = this.allVisibleLibraryBooksSelected ? [] : this.visibleLibraryBookIds;
	};

	handleToggleSelectedBook = (book: LibraryBook): void => {
		if (this.isBulkActionPending) {
			return;
		}

		this.selectedBookIds = toggleBookSelection(this.selectedBookIds, book.id);
	};

	openResetModal = (book: LibraryBook): void => {
		this.bookToReset = book;
		this.showConfirmModal = true;
	};

	closeResetModal = (): void => {
		this.showConfirmModal = false;
		this.bookToReset = null;
	};

	async confirmResetStatus(): Promise<void> {
		if (!this.bookToReset) {
			return;
		}
		const book = this.bookToReset;
		this.closeResetModal();
		const originalStatus = Boolean(book.isDownloaded);
		this.setBookDownloadedState(book.id, false);
		const result = await ZUI.resetDownloadStatus(book.id);
		if (!result.ok) {
			this.setBookDownloadedState(book.id, originalStatus);
			toastStore.add(`Failed to reset status: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Reset download status for "${book.title}"`, 'success');
	}

	requestDeleteTrashedBook = (book: LibraryBook): void => {
		this.pendingDeleteTrashBook = book;
		this.showDeleteTrashModal = true;
	};

	cancelDeleteTrashedBook = (): void => {
		if (this.deletingTrashBookId !== null) {
			return;
		}
		this.showDeleteTrashModal = false;
		this.pendingDeleteTrashBook = null;
	};

	async confirmDeleteTrashedBook(): Promise<void> {
		const book = this.pendingDeleteTrashBook;
		if (!book) {
			return;
		}
		if (this.restoringBookId !== null || this.deletingTrashBookId !== null) {
			return;
		}
		this.deletingTrashBookId = book.id;
		const result = await deleteTrashedLibraryBookAction(
			book,
			`Deleted "${book.title}" permanently`
		);
		this.deletingTrashBookId = null;
		if (!result.ok) {
			return;
		}
		await this.loadLibrary();
		await this.loadTrash();
		this.showDeleteTrashModal = false;
		this.pendingDeleteTrashBook = null;
	}

	async handleRestoreBook(book: LibraryBook): Promise<void> {
		if (this.restoringBookId !== null || this.deletingTrashBookId !== null) {
			return;
		}
		this.restoringBookId = book.id;
		const result = await restoreLibraryBookAction(book);
		this.restoringBookId = null;
		if (!result.ok) {
			return;
		}
		await this.loadLibrary();
		await this.loadTrash();
	}

	requestBulkMoveToTrash = (): void => {
		if (this.selectedBooks.length === 0 || this.isBulkActionPending) {
			return;
		}

		this.showBulkTrashModal = true;
	};

	cancelBulkMoveToTrash = (): void => {
		if (this.isBulkActionPending) {
			return;
		}

		this.showBulkTrashModal = false;
	};

	async handleBulkArchiveSelected(): Promise<void> {
		const targetBooks = this.getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await this.executeBulkBookAction({
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

	async handleBulkMarkReadSelected(): Promise<void> {
		const targetBooks = this.getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await this.executeBulkBookAction({
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

	async handleBulkMarkUnreadSelected(): Promise<void> {
		const targetBooks = this.getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await this.executeBulkBookAction({
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

	async confirmBulkMoveToTrash(): Promise<void> {
		const targetBooks = this.getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			this.showBulkTrashModal = false;
			return;
		}

		await this.executeBulkBookAction({
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

	async handleBulkResetDownloadsSelected(): Promise<void> {
		const targetBooks = this.getSelectedBooksOrToast();
		if (targetBooks.length === 0) {
			return;
		}

		await this.executeBulkBookAction({
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

	async handleBulkShelfSelection(
		shelfId: number,
		action: LibraryBulkShelfAction
	): Promise<void> {
		const requestedBooks = this.getSelectedBooksOrToast();
		if (requestedBooks.length === 0) {
			return;
		}

		const shelf = this.shelves.find((candidate) => candidate.id === shelfId);
		const shelfLabel = shelf ? `"${shelf.name}"` : 'the selected shelf';
		const actionVerb = action === 'add' ? 'add to shelf' : 'remove from shelf';
		const successVerb = action === 'add' ? 'Added' : 'Removed';
		const targetBooks = requestedBooks.filter((book) => {
			const nextShelfIds = applyBulkShelfSelection(book.shelfIds, shelfId, action);
			const currentShelfIds = [...new Set(book.shelfIds)].sort((a, b) => a - b);
			return !this.areNumberListsEqual(nextShelfIds, currentShelfIds);
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

		await this.executeBulkBookAction({
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

	async handleToggleBookShelf(bookId: number, shelfId: number): Promise<void> {
		if (this.isUpdatingShelves) {
			return;
		}
		const book = this.books.find((item) => item.id === bookId);
		if (!book) {
			return;
		}
		const currentIds = [...new Set(book.shelfIds)];
		const nextIds = currentIds.includes(shelfId)
			? currentIds.filter((id) => id !== shelfId)
			: [...currentIds, shelfId];
		this.isUpdatingShelves = true;
		const result = await ZUI.setLibraryBookShelves(bookId, nextIds);
		this.isUpdatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to update shelves: ${result.error.message}`, 'error');
			return;
		}
		this.setBookShelfIdsState(bookId, result.value.shelfIds);
	}

	setSortField = (value: LibrarySortField): void => {
		const nextSortPreference = { ...this.sortPreference, field: value };
		this.sortPreference = nextSortPreference;
		if (typeof localStorage !== 'undefined') {
			writeStoredLibrarySort(localStorage, this.selectedShelfId, nextSortPreference);
		}
	};

	setSortDirection = (value: LibrarySortDirection): void => {
		this.showFilters = false;
		const nextSortPreference = { ...this.sortPreference, direction: value };
		this.sortPreference = nextSortPreference;
		if (typeof localStorage !== 'undefined') {
			writeStoredLibrarySort(localStorage, this.selectedShelfId, nextSortPreference);
		}
	};

	async selectFilterOption(
		option: LibraryStatusFilter | 'archivedView' | 'trashView'
	): Promise<void> {
		this.showFilters = false;
		if (option === 'archivedView') {
			this.statusFilter = 'all';
			await goto('/archived');
			return;
		}
		if (option === 'trashView') {
			this.statusFilter = 'all';
			await goto('/trash');
			return;
		}
		if (this.currentView !== 'library') {
			await this.switchView('library');
		}
		this.statusFilter = option;
	}

	async switchView(nextView: LibraryView): Promise<void> {
		if (this.currentView === nextView) {
			return;
		}
		this.showSortFieldMenu = false;
		this.showFilters = false;
		this.currentView = nextView;
		if (!this.isDetailModalOpen) {
			this.updateLibraryUrl(null);
		}
		if (nextView === 'library' || nextView === 'archived') {
			await this.loadLibrary();
			return;
		}
		await this.loadTrash();
	}

	applyBookMetadataUpdate(updated: LibraryMetadataUpdate): LibraryBook | null {
		const index = this.books.findIndex((book) => book.id === updated.id);
		if (index === -1) {
			return null;
		}

		const updatedBook: LibraryBook = {
			...this.books[index],
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
			day: updated.day,
			createdAt: updated.createdAt
		};

		this.books = [...this.books.slice(0, index), updatedBook, ...this.books.slice(index + 1)];
		return updatedBook;
	}

	setBookDownloadedState(bookId: number, isDownloaded: boolean): LibraryBook | null {
		return this.updateBook(bookId, (book) => ({
			...book,
			isDownloaded
		}));
	}

	setBookRatingState(bookId: number, rating: number | null): LibraryBook | null {
		return this.updateBook(bookId, (book) => ({
			...book,
			rating
		}));
	}

	setBookCoverState(bookId: number, cover: string | null): LibraryBook | null {
		return this.updateBook(bookId, (book) => ({
			...book,
			cover
		}));
	}

	setBookArchiveState(
		bookId: number,
		archivedAt: string | null,
		excludeFromNewBooks: boolean
	): LibraryBook | null {
		return this.updateBook(bookId, (book) => ({
			...book,
			archived_at: archivedAt,
			exclude_from_new_books: excludeFromNewBooks
		}));
	}

	setBookShelfIdsState(bookId: number, shelfIds: number[]): LibraryBook | null {
		const normalized = [...new Set(shelfIds)].sort((a, b) => a - b);
		return this.updateBook(bookId, (book) => ({
			...book,
			shelfIds: normalized
		}));
	}

	private updateBook(
		bookId: number,
		updater: (book: LibraryBook) => LibraryBook
	): LibraryBook | null {
		const index = this.books.findIndex((book) => book.id === bookId);
		if (index === -1) {
			return null;
		}
		const updatedBook = updater(this.books[index]);
		this.books = [...this.books.slice(0, index), updatedBook, ...this.books.slice(index + 1)];
		return updatedBook;
	}

	private getSelectedBooksOrToast(): LibraryBook[] {
		if (this.selectedBooks.length === 0) {
			toastStore.add('Select at least one visible book first', 'error');
			return [];
		}

		return this.selectedBooks;
	}

	private formatBulkFailureSummary(
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

	private async executeBulkBookAction(options: {
		actionLabel: string;
		successMessage: (successCount: number) => string;
		targetBooks: LibraryBook[];
		reloadTrash?: boolean;
		run: (book: LibraryBook) => Promise<BulkActionResult>;
	}): Promise<void> {
		if (options.targetBooks.length === 0 || this.isBulkActionPending) {
			return;
		}

		this.isBulkActionPending = true;
		this.showBulkTrashModal = false;

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
				.filter(
					(outcome): outcome is { book: LibraryBook; ok: false; message: string } =>
						!outcome.ok
				)
				.map((outcome) => ({ book: outcome.book, message: outcome.message }));

			if (successCount > 0) {
				await this.loadLibrary();
				if (options.reloadTrash) {
					await this.loadTrash();
				}
				toastStore.add(options.successMessage(successCount), 'success');
			}

			if (failures.length > 0) {
				toastStore.add(
					this.formatBulkFailureSummary(options.actionLabel, failures),
					'error',
					5000
				);
			}
		} finally {
			this.isBulkActionPending = false;
		}
	}

	private areNumberListsEqual(left: number[], right: number[]): boolean {
		return left.length === right.length && left.every((value, index) => value === right[index]);
	}
}
