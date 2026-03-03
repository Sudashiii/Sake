<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import type { LibraryBook } from "$lib/types/Library/Book";
	import type { LibraryBookDetail } from "$lib/types/Library/BookDetail";
	import type { LibraryShelf } from "$lib/types/Library/Shelf";
	import type { BookProgressHistoryEntry } from "$lib/types/Library/BookProgressHistory";
	import type { ApiError } from "$lib/types/ApiError";
	import Loading from "$lib/components/Loading.svelte";
	import ConfirmModal from "$lib/components/ConfirmModal.svelte";
	import BookDetailModalShell from "$lib/components/BookDetailModalShell.svelte";
	import { ZUI } from "$lib/client/zui";

	import { toastStore } from "$lib/client/stores/toastStore.svelte";

	type LibrarySort = "dateAdded" | "titleAsc" | "progressRecent";
	type LibraryView = "library" | "archived" | "trash";
	type LibraryStatusFilter = "all" | "unread" | "reading" | "read";
	type LibraryVisualMode = "grid" | "list";
	type DetailTab = "overview" | "progress" | "metadata" | "devices";
	type MetadataDraft = {
		title: string;
		author: string;
		publisher: string;
		series: string;
		volume: string;
		edition: string;
		identifier: string;
		pages: string;
		description: string;
		cover: string;
		language: string;
		year: string;
		googleBooksId: string;
		openLibraryKey: string;
		amazonAsin: string;
		externalRating: string;
		externalRatingCount: string;
	};
	const LIBRARY_SORT_KEY = "librarySort";

	function parseViewFromUrl(value: string | null): LibraryView | null {
		if (value === "library" || value === "archived" || value === "trash") {
			return value;
		}
		return null;
	}

	let books = $state<LibraryBook[]>([]);
	let shelves = $state<LibraryShelf[]>([]);
	let trashBooks = $state<LibraryBook[]>([]);
	let isLoading = $state(true);
	let error = $state<ApiError | null>(null);
	let sortBy = $state<LibrarySort>("dateAdded");
	let currentView = $state<LibraryView>("library");
	let searchQuery = $state("");
	let statusFilter = $state<LibraryStatusFilter>("all");
	let visualMode = $state<LibraryVisualMode>("grid");
	let showFilters = $state(false);
	let showSortMenu = $state(false);
	let showShelfAssign = $state<number | null>(null);

	let showConfirmModal = $state(false);
	let bookToReset = $state<LibraryBook | null>(null);
	let showDetailModal = $state(false);
	let selectedBook = $state<LibraryBook | null>(null);
	let selectedBookDetail = $state<LibraryBookDetail | null>(null);
	let detailModalView = $state<LibraryView | null>(null);
	let activeDetailTab = $state<DetailTab>("overview");
	let isDetailLoading = $state(false);
	let isRefetchingMetadata = $state(false);
	let isProgressHistoryLoading = $state(false);
	let showProgressHistory = $state(false);
	let removingDeviceId = $state<string | null>(null);
	let isMovingToTrash = $state(false);
	let isDownloadingLibraryFile = $state(false);
	let isUploadingLibraryFile = $state(false);
	let isUpdatingRating = $state(false);
	let isUpdatingReadState = $state(false);
	let isUpdatingArchiveState = $state(false);
	let isUpdatingNewBooksExclusion = $state(false);
	let isUpdatingShelves = $state(false);
	let isEditingMetadata = $state(false);
	let isSavingMetadata = $state(false);
	let restoringBookId = $state<number | null>(null);
	let deletingTrashBookId = $state<number | null>(null);
	let pendingDeleteTrashBook = $state<LibraryBook | null>(null);
	let showDeleteTrashModal = $state(false);
	let detailError = $state<string | null>(null);
	let progressHistoryError = $state<string | null>(null);
	let progressHistory = $state<BookProgressHistoryEntry[]>([]);
	let uploadInputEl = $state<HTMLInputElement | null>(null);
	let metadataDraft = $state<MetadataDraft>({
		title: "",
		author: "",
		publisher: "",
		series: "",
		volume: "",
		edition: "",
		identifier: "",
		pages: "",
		description: "",
		cover: "",
		language: "",
		year: "",
		googleBooksId: "",
		openLibraryKey: "",
		amazonAsin: "",
		externalRating: "",
		externalRatingCount: ""
	});

	let activeLibraryBooks = $derived(books.filter((book) => !book.archived_at));
	let archivedBooks = $derived(books.filter((book) => Boolean(book.archived_at)));
	let sortedBooks = $derived(sortBooks(activeLibraryBooks, sortBy));
	let sortedArchivedBooks = $derived(sortBooks(archivedBooks, sortBy));
	let selectedShelfId = $derived.by(() => {
		if ($page.url.pathname !== "/library") {
			return null;
		}
		const raw = $page.url.searchParams.get("shelf");
		if (!raw) {
			return null;
		}
		const parsed = Number.parseInt(raw, 10);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	});
	let shelfScopedLibraryBooks = $derived(
		selectedShelfId === null
			? sortedBooks
			: sortedBooks.filter((book) => matchesBookShelf(book, selectedShelfId))
	);
	let filteredLibraryBooks = $derived(
		sortedBooks.filter(
			(book) =>
				matchesBookQuery(book, searchQuery) &&
				matchesBookStatus(book, statusFilter) &&
				matchesBookShelf(book, selectedShelfId)
		)
	);
	let filteredArchivedBooks = $derived(
		sortedArchivedBooks.filter((book) => matchesBookQuery(book, searchQuery))
	);
	let libraryStats = $derived({
		total: shelfScopedLibraryBooks.length,
		reading: shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === "reading").length,
		unread: shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === "unread").length,
		read: shelfScopedLibraryBooks.filter((book) => getBookStatus(book) === "read").length
	});
	const DETAIL_PROGRESS_PREVIEW_COUNT = 5;
	let hasMoreProgressHistory = $derived(
		progressHistory.length > DETAIL_PROGRESS_PREVIEW_COUNT
	);
	let visibleProgressHistory = $derived(
		showProgressHistory
			? progressHistory
			: progressHistory.slice(0, DETAIL_PROGRESS_PREVIEW_COUNT)
	);

	onMount(() => {
		const handleShelvesChanged = () => {
			void loadShelves();
		};
		if (typeof window !== "undefined") {
			window.addEventListener("shelves:changed", handleShelvesChanged);
		}

		(async () => {
			if (typeof localStorage !== "undefined") {
				const stored = localStorage.getItem(LIBRARY_SORT_KEY);
				if (stored === "dateAdded" || stored === "titleAsc" || stored === "progressRecent") {
					sortBy = stored;
				}
			}

			const params = new URLSearchParams(window.location.search);
			const requestedView = parseViewFromUrl(params.get("view"));
			const openBookIdParam = params.get("openBookId");
			const openBookId = openBookIdParam ? Number.parseInt(openBookIdParam, 10) : NaN;

			if (requestedView === "archived") {
				const archivedTarget = Number.isNaN(openBookId)
					? "/archived"
					: `/archived?openBookId=${openBookId}`;
				await goto(archivedTarget, { replaceState: true });
				return;
			}

			if (requestedView === "trash") {
				await goto("/trash", { replaceState: true });
				return;
			}

			if (requestedView === "library") {
				currentView = "library";
			}

			if (currentView === "trash") {
				await loadTrash();
				return;
			}

			await loadLibrary();
			await loadShelves();

			if (!Number.isNaN(openBookId)) {
				const candidate = books.find(
					(book) =>
						book.id === openBookId &&
						(currentView !== "archived" || Boolean(book.archived_at))
				);
				if (candidate) {
					await openDetailModal(candidate);
				}
			}
		})();

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("shelves:changed", handleShelvesChanged);
			}
		};
	});

	function updateLibraryUrl(openBookId?: number | null): void {
		if (typeof window === "undefined") {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		params.delete("view");
		if (typeof openBookId === "number") {
			params.set("openBookId", String(openBookId));
		} else {
			params.delete("openBookId");
		}

		const query = params.toString();
		const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
		window.history.replaceState(window.history.state, "", next);
	}

	async function loadLibrary() {
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
			toastStore.add(`Failed to load shelves: ${result.error.message}`, "error");
			return;
		}

		shelves = result.value.shelves;
		if (selectedShelfId !== null && !shelves.some((shelf) => shelf.id === selectedShelfId)) {
			updateShelfUrl(null);
		}
	}

	function updateShelfUrl(shelfId: number | null): void {
		if (typeof window === "undefined") {
			return;
		}
		const params = new URLSearchParams(window.location.search);
		if (shelfId === null) {
			params.delete("shelf");
		} else {
			params.set("shelf", String(shelfId));
		}

		const query = params.toString();
		const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
		window.history.replaceState(window.history.state, "", next);
	}

	async function loadTrash() {
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

	function openResetModal(book: LibraryBook) {
		bookToReset = book;
		showConfirmModal = true;
	}

	function closeResetModal() {
		showConfirmModal = false;
		bookToReset = null;
	}

	async function openDetailModal(book: LibraryBook) {
		await loadShelves();
		detailModalView = currentView;
		updateLibraryUrl(book.id);
		selectedBook = book;
		selectedBookDetail = null;
		activeDetailTab = "overview";
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

	function closeDetailModal() {
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
		progressHistoryError = null;
		progressHistory = [];
		showProgressHistory = false;
		activeDetailTab = "overview";
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

	function toDraftText(value: string | number | null | undefined): string {
		return value === null || value === undefined ? "" : String(value);
	}

	function initializeMetadataDraft(detail: LibraryBookDetail): void {
		metadataDraft = {
			title: toDraftText(detail.title),
			author: toDraftText(detail.author),
			publisher: toDraftText(detail.publisher),
			series: toDraftText(detail.series),
			volume: toDraftText(detail.volume),
			edition: toDraftText(detail.edition),
			identifier: toDraftText(detail.identifier),
			pages: toDraftText(detail.pages),
			description: toDraftText(detail.description),
			cover: toDraftText(selectedBook?.cover ?? ""),
			language: toDraftText(selectedBook?.language ?? ""),
			year: toDraftText(selectedBook?.year ?? ""),
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
			year: updated.year
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
			toastStore.add(`Failed to refetch metadata: ${result.error.message}`, "error");
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
				volume: result.value.book.volume,
				edition: result.value.book.edition,
				identifier: result.value.book.identifier,
				pages: result.value.book.pages,
				description: result.value.book.description,
				googleBooksId: result.value.book.googleBooksId,
				openLibraryKey: result.value.book.openLibraryKey,
				amazonAsin: result.value.book.amazonAsin,
				externalRating: result.value.book.externalRating,
				externalRatingCount: result.value.book.externalRatingCount
			};
			initializeMetadataDraft(selectedBookDetail);
		}
		detailError = null;
		toastStore.add("Book metadata refreshed", "success");
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

	function parseNullableNumber(value: string): number | null {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}

	async function saveMetadataEdit(): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isSavingMetadata) {
			return;
		}

		const title = metadataDraft.title.trim();
		if (!title) {
			toastStore.add("Title cannot be empty", "error");
			return;
		}

		isSavingMetadata = true;
		const updateResult = await ZUI.updateLibraryBookMetadata(selectedBook.id, {
			title,
			author: metadataDraft.author.trim() || null,
			publisher: metadataDraft.publisher.trim() || null,
			series: metadataDraft.series.trim() || null,
			volume: metadataDraft.volume.trim() || null,
			edition: metadataDraft.edition.trim() || null,
			identifier: metadataDraft.identifier.trim() || null,
			pages: parseNullableNumber(metadataDraft.pages),
			description: metadataDraft.description.trim() || null,
			cover: metadataDraft.cover.trim() || null,
			language: metadataDraft.language.trim() || null,
			year: parseNullableNumber(metadataDraft.year),
			googleBooksId: metadataDraft.googleBooksId.trim() || null,
			openLibraryKey: metadataDraft.openLibraryKey.trim() || null,
			amazonAsin: metadataDraft.amazonAsin.trim() || null,
			externalRating: parseNullableNumber(metadataDraft.externalRating),
			externalRatingCount: parseNullableNumber(metadataDraft.externalRatingCount),
		});
		isSavingMetadata = false;

		if (!updateResult.ok) {
			toastStore.add(`Failed to save metadata: ${updateResult.error.message}`, "error");
			return;
		}

		const detailResult = await ZUI.getLibraryBookDetail(selectedBook.id);
		if (detailResult.ok) {
			selectedBookDetail = detailResult.value;
			initializeMetadataDraft(detailResult.value);
		}

		await loadLibrary();
		isEditingMetadata = false;
		toastStore.add("Metadata updated", "success");
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

	async function handleSetRating(rating: number | null): Promise<void> {
		if (!selectedBook || isUpdatingRating) {
			return;
		}

		isUpdatingRating = true;
		const result = await ZUI.updateLibraryBookRating(selectedBook.id, rating);
		isUpdatingRating = false;

		if (!result.ok) {
			toastStore.add(`Failed to update rating: ${result.error.message}`, "error");
			return;
		}

		setBookRatingState(selectedBook.id, result.value.rating);
		if (result.value.rating === null) {
			toastStore.add("Rating cleared", "success");
		} else {
			toastStore.add(
				`Rating updated to ${result.value.rating} star${result.value.rating === 1 ? "" : "s"}`,
				"success"
			);
		}
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
			toastStore.add(`Failed to update read state: ${result.error.message}`, "error");
			return;
		}

		selectedBookDetail = {
			...selectedBookDetail,
			isRead: result.value.isRead,
			readAt: result.value.readAt,
			progressPercent:
				typeof result.value.progressPercent === "number"
					? Math.max(0, Math.min(100, result.value.progressPercent * 100))
					: null
		};
		toastStore.add(result.value.isRead ? "Marked as read" : "Marked as unread", "success");
	}

	async function handleToggleExcludeFromNewBooks(): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isUpdatingNewBooksExclusion) {
			return;
		}

		const nextValue = !selectedBookDetail.excludeFromNewBooks;
		isUpdatingNewBooksExclusion = true;
		const result = await ZUI.updateLibraryBookState(selectedBook.id, {
			excludeFromNewBooks: nextValue
		});
		isUpdatingNewBooksExclusion = false;

		if (!result.ok) {
			toastStore.add(`Failed to update new-books exclusion: ${result.error.message}`, "error");
			return;
		}

		selectedBookDetail = {
			...selectedBookDetail,
			excludeFromNewBooks: result.value.excludeFromNewBooks
		};
		toastStore.add(
			result.value.excludeFromNewBooks
				? "Book excluded from new-books API"
				: "Book included in new-books API",
			"success"
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
			toastStore.add(`Failed to update archive state: ${result.error.message}`, "error");
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
				? "Book archived (it will no longer appear in New Books API)"
				: "Book unarchived",
			"success"
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
			toastStore.add(`Failed to remove device download: ${result.error.message}`, "error");
			return;
		}

		const remaining = selectedBookDetail.downloadedDevices.filter((item) => item !== deviceId);
		selectedBookDetail = {
			...selectedBookDetail,
			downloadedDevices: remaining
		};
		setBookDownloadedState(selectedBook.id, remaining.length > 0);
		toastStore.add(`Removed download for device "${deviceId}"`, "success");
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
			toastStore.add(`Failed to move book to trash: ${result.error.message}`, "error");
			return;
		}

		toastStore.add(`Moved "${targetBook.title}" to trash`, "success");
		closeDetailModal();
		await loadLibrary();
		await loadTrash();
	}

	function buildLibraryDownloadName(book: LibraryBook): string {
		const rawTitle = (book.title || "book").trim();
		const title = rawTitle.length > 0 ? rawTitle : "book";
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
			toastStore.add(`Failed to download from library: ${result.error.message}`, "error");
			return;
		}

		toastStore.add(`Downloaded "${targetBook.title}"`, "success");
	}

	async function handleRestoreBook(book: LibraryBook): Promise<void> {
		if (restoringBookId !== null || deletingTrashBookId !== null) {
			return;
		}

		restoringBookId = book.id;
		const result = await ZUI.restoreLibraryBook(book.id);
		restoringBookId = null;

		if (!result.ok) {
			toastStore.add(`Failed to restore book: ${result.error.message}`, "error");
			return;
		}

		toastStore.add(`Restored "${book.title}"`, "success");
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
			toastStore.add(`Failed to delete permanently: ${result.error.message}`, "error");
			return;
		}

		toastStore.add(`Deleted "${book.title}" permanently`, "success");
		await loadLibrary();
		await loadTrash();
		showDeleteTrashModal = false;
		pendingDeleteTrashBook = null;
	}

	function openLibraryUploadPicker(): void {
		if (currentView !== "library" || isUploadingLibraryFile) {
			return;
		}

		uploadInputEl?.click();
	}

	async function handleLibraryUploadChange(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || isUploadingLibraryFile) {
			return;
		}

		isUploadingLibraryFile = true;
		const result = await ZUI.uploadLibraryBookFile(file);
		isUploadingLibraryFile = false;
		input.value = "";

		if (!result.ok) {
			toastStore.add(`Failed to upload book: ${result.error.message}`, "error");
			return;
		}

		toastStore.add(`Uploaded "${file.name}"`, "success");
		await loadLibrary();
	}

	async function confirmResetStatus() {
		if (!bookToReset) return;
		
		const book = bookToReset;
		closeResetModal();

		const originalStatus = book.isDownloaded;
		const index = books.findIndex((b) => b.id === book.id);
		if (index !== -1) {
			const updatedBooks = [...books];
			updatedBooks[index] = {
				...updatedBooks[index],
				isDownloaded: false,
			};
			books = updatedBooks;
		}

		const result = await ZUI.resetDownloadStatus(book.id);

		if (!result.ok) {
			// Revert if failed
			const revertIndex = books.findIndex((b) => b.id === book.id);
			if (revertIndex !== -1) {
				const updatedBooks = [...books];
				updatedBooks[revertIndex] = {
					...updatedBooks[revertIndex],
					isDownloaded: originalStatus,
				};
				books = updatedBooks;
			}
			toastStore.add(
				`Failed to reset status: ${result.error.message}`,
				"error",
			);
		} else {
			toastStore.add(
				`Reset download status for "${book.title}"`,
				"success",
			);
		}
	}

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return "Unknown";
		const units = ["B", "KB", "MB", "GB"];
		let size = bytes;
		let unitIndex = 0;
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}
		return `${size.toFixed(1)} ${units[unitIndex]}`;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return "Unknown";
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	function normalizeText(value: string | null | undefined): string {
		return (value ?? "").toLowerCase();
	}

	function matchesBookQuery(book: LibraryBook, query: string): boolean {
		const q = query.trim().toLowerCase();
		if (!q) {
			return true;
		}

		return (
			normalizeText(book.title).includes(q) ||
			normalizeText(book.author).includes(q) ||
			normalizeText(book.publisher).includes(q)
		);
	}

	function getProgressPercent(book: LibraryBook): number {
		if (typeof book.progressPercent !== "number") {
			return 0;
		}

		return Math.max(0, Math.min(100, book.progressPercent));
	}

	function getBookStatus(book: LibraryBook): Exclude<LibraryStatusFilter, "all"> {
		const progress = getProgressPercent(book);
		if (book.read_at || progress >= 99.9) {
			return "read";
		}
		if (progress > 0.1) {
			return "reading";
		}
		return "unread";
	}

	function matchesBookStatus(book: LibraryBook, filter: LibraryStatusFilter): boolean {
		return filter === "all" ? true : getBookStatus(book) === filter;
	}

	function matchesBookShelf(book: LibraryBook, shelfId: number | null): boolean {
		if (shelfId === null) {
			return true;
		}
		return (book.shelfIds ?? []).includes(shelfId);
	}

	function getDetailStatusLabel(detail: LibraryBookDetail): "Unread" | "Reading" | "Read" {
		if (detail.isRead || (detail.progressPercent ?? 0) >= 99.9) {
			return "Read";
		}
		if ((detail.progressPercent ?? 0) > 0.1) {
			return "Reading";
		}
		return "Unread";
	}

	function getDetailStatusClass(detail: LibraryBookDetail): "read" | "reading" | "unread" {
		const status = getDetailStatusLabel(detail);
		if (status === "Read") {
			return "read";
		}
		if (status === "Reading") {
			return "reading";
		}
		return "unread";
	}

	function clampProgress(value: number | null): number {
		if (typeof value !== "number") {
			return 0;
		}
		return Math.max(0, Math.min(100, value));
	}

	function getFormatBadgeClass(extension: string | null): string {
		const format = (extension ?? "").trim().toLowerCase();
		if (format === "pdf") {
			return "pdf";
		}
		if (format === "mobi") {
			return "mobi";
		}
		return "epub";
	}

	function getRoundedRating(rating: number | null | undefined): number {
		if (typeof rating !== "number" || Number.isNaN(rating)) {
			return 0;
		}
		return Math.max(0, Math.min(5, Math.round(rating)));
	}

	function formatProgress(percent: number | null): string {
		if (percent === null) return "No progress yet";
		return `${percent.toFixed(1)}%`;
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

		const currentIds = [...new Set(book.shelfIds ?? [])];
		const nextIds = currentIds.includes(shelfId)
			? currentIds.filter((id) => id !== shelfId)
			: [...currentIds, shelfId];

		isUpdatingShelves = true;
		const result = await ZUI.setLibraryBookShelves(bookId, nextIds);
		isUpdatingShelves = false;

		if (!result.ok) {
			toastStore.add(`Failed to update shelves: ${result.error.message}`, "error");
			return;
		}

		setBookShelfIdsState(bookId, result.value.shelfIds);
	}

	async function handleToggleShelfAssignment(shelfId: number): Promise<void> {
		if (!selectedBook || !selectedBookDetail || isUpdatingShelves) {
			return;
		}

		const currentIds = [...new Set(selectedBookDetail.shelfIds ?? [])];
		const nextIds = currentIds.includes(shelfId)
			? currentIds.filter((id) => id !== shelfId)
			: [...currentIds, shelfId];

		isUpdatingShelves = true;
		const result = await ZUI.setLibraryBookShelves(selectedBook.id, nextIds);
		isUpdatingShelves = false;

		if (!result.ok) {
			toastStore.add(`Failed to update shelves: ${result.error.message}`, "error");
			return;
		}

		setBookShelfIdsState(selectedBook.id, result.value.shelfIds);
	}

	function formatDateTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		});
	}

	function toGoogleBooksUrl(googleBooksId: string): string {
		return `https://books.google.com/books?id=${encodeURIComponent(googleBooksId)}`;
	}

	function toOpenLibraryUrl(openLibraryKey: string): string {
		const normalized = openLibraryKey.startsWith("/") ? openLibraryKey : `/${openLibraryKey}`;
		return `https://openlibrary.org${normalized}`;
	}

	function getCurrentPage(progressPercent: number | null, pages: number | null): number | null {
		if (progressPercent === null || pages === null || pages <= 0) {
			return null;
		}

		const ratio = Math.max(0, Math.min(100, progressPercent)) / 100;
		if (ratio === 0) {
			return 0;
		}

		return Math.min(pages, Math.max(1, Math.round(ratio * pages)));
	}

	function getProgressHistoryPageRange(
		history: BookProgressHistoryEntry[],
		index: number,
		pages: number | null
	): string | null {
		if (!pages || pages <= 0) {
			return null;
		}

		const current = history[index];
		if (!current) {
			return null;
		}

		const previous = history[index + 1];
		const startPage = getCurrentPage(previous?.progressPercent ?? current.progressPercent, pages);
		const endPage = getCurrentPage(current.progressPercent, pages);
		if (startPage === null || endPage === null) {
			return null;
		}

		return `Page ${startPage} -> ${endPage}`;
	}

	function setSortBy(value: LibrarySort): void {
		sortBy = value;
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(LIBRARY_SORT_KEY, value);
		}
	}

	function getSortLabel(value: LibrarySort): string {
		if (value === "titleAsc") {
			return "Title A-Z";
		}
		if (value === "progressRecent") {
			return "Recent Progress";
		}
		return "Date Added";
	}

	function getFilterLabel(): string {
		if (currentView === "archived") {
			return "Archived";
		}
		if (currentView === "trash") {
			return "Trash";
		}
		if (statusFilter === "all") {
			return "All";
		}
		if (statusFilter === "read") {
			return "Read";
		}
		if (statusFilter === "reading") {
			return "Reading";
		}
		return "Unread";
	}

	async function selectFilterOption(
		option: LibraryStatusFilter | "archivedView" | "trashView"
	): Promise<void> {
		showFilters = false;

		if (option === "archivedView") {
			statusFilter = "all";
			await goto("/archived");
			return;
		}

		if (option === "trashView") {
			statusFilter = "all";
			await goto("/trash");
			return;
		}

		if (currentView !== "library") {
			await switchView("library");
		}

		statusFilter = option;
	}

	function sortBooks(list: LibraryBook[], mode: LibrarySort): LibraryBook[] {
		const copy = [...list];
		if (mode === "titleAsc") {
			return copy.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
		}

		if (mode === "progressRecent") {
			return copy.sort((a, b) => {
				const aTime = a.progress_updated_at ? Date.parse(a.progress_updated_at) : 0;
				const bTime = b.progress_updated_at ? Date.parse(b.progress_updated_at) : 0;
				return bTime - aTime;
			});
		}

		return copy.sort((a, b) => {
			const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
			const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
			return bTime - aTime;
		});
	}

	async function switchView(nextView: LibraryView): Promise<void> {
		if (currentView === nextView) {
			return;
		}

		showSortMenu = false;
		showFilters = false;
		currentView = nextView;
		if (!showDetailModal) {
			updateLibraryUrl(null);
		}
		if (nextView === "library" || nextView === "archived") {
			await loadLibrary();
			return;
		}

		await loadTrash();
	}
</script>

<div class={`library-page ${currentView}-view`}>
	<Loading bind:show={isLoading} />

	{#if error}
		<div class="error">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
			<p>{error.message}</p>
			<button onclick={loadLibrary}>Retry</button>
		</div>
	{/if}

	{#if currentView === "library"}
		<section class="stats-grid">
			<div class="stat-card">
				<p>Total Books</p>
				<h2>{libraryStats.total}</h2>
			</div>
			<div class="stat-card">
				<p>Reading</p>
				<h2 class="accent-reading">{libraryStats.reading}</h2>
			</div>
			<div class="stat-card">
				<p>Unread</p>
				<h2 class="accent-unread">{libraryStats.unread}</h2>
			</div>
			<div class="stat-card">
				<p>Completed</p>
				<h2 class="accent-read">{libraryStats.read}</h2>
			</div>
		</section>

	{/if}

	<section class="toolbar-row">
		<label class="search-wrap" for="library-search">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			<input
				id="library-search"
				type="text"
				bind:value={searchQuery}
				placeholder={
					currentView === "library"
						? "Search your library..."
						: currentView === "archived"
							? "Search archived books..."
							: "Search trash..."
				}
			/>
		</label>

		<div class="toolbar-actions">
			{#if currentView === "library"}
				<button
					type="button"
					class="import-btn"
					onclick={openLibraryUploadPicker}
					disabled={isUploadingLibraryFile}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 3v12"></path>
						<path d="m7 8 5-5 5 5"></path>
						<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
					</svg>
					<span>{isUploadingLibraryFile ? "Importing..." : "Import"}</span>
				</button>
				<input class="upload-input" type="file" bind:this={uploadInputEl} onchange={handleLibraryUploadChange} />
			{/if}

			{#if currentView !== "trash"}
				<div class="menu-wrap">
					<button
						type="button"
						class="control-btn"
						onclick={() => {
							showSortMenu = !showSortMenu;
							showFilters = false;
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
							<path d="m3 16 4 4 4-4"></path>
							<path d="M7 20V4"></path>
							<path d="m21 8-4-4-4 4"></path>
							<path d="M17 4v16"></path>
						</svg>
						<span>{getSortLabel(sortBy)}</span>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</button>
					{#if showSortMenu}
						<button type="button" class="menu-backdrop" aria-label="Close sort menu" onclick={() => (showSortMenu = false)}></button>
						<div class="menu-popover">
							<button type="button" class:active={sortBy === "dateAdded"} onclick={() => { setSortBy("dateAdded"); showSortMenu = false; }}>Date Added</button>
							<button type="button" class:active={sortBy === "titleAsc"} onclick={() => { setSortBy("titleAsc"); showSortMenu = false; }}>Title A-Z</button>
							<button type="button" class:active={sortBy === "progressRecent"} onclick={() => { setSortBy("progressRecent"); showSortMenu = false; }}>Recent Progress</button>
						</div>
					{/if}
				</div>
			{/if}

			<div class="menu-wrap">
				<button
					type="button"
					class="control-btn"
					onclick={() => {
						showFilters = !showFilters;
						showSortMenu = false;
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 6h18"></path>
						<path d="M7 12h10"></path>
						<path d="M10 18h4"></path>
					</svg>
					<span>{getFilterLabel()}</span>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</button>
				{#if showFilters}
					<button type="button" class="menu-backdrop" aria-label="Close filter menu" onclick={() => (showFilters = false)}></button>
					<div class="menu-popover filter-popover">
						<button type="button" class:active={currentView === "library" && statusFilter === "all"} onclick={() => selectFilterOption("all")}>All</button>
						<button type="button" class:active={currentView === "library" && statusFilter === "unread"} onclick={() => selectFilterOption("unread")}>Unread</button>
						<button type="button" class:active={currentView === "library" && statusFilter === "reading"} onclick={() => selectFilterOption("reading")}>Reading</button>
						<button type="button" class:active={currentView === "library" && statusFilter === "read"} onclick={() => selectFilterOption("read")}>Read</button>
						<div class="menu-separator"></div>
						<button type="button" class:active={currentView === "archived"} onclick={() => selectFilterOption("archivedView")}>Archived</button>
						<button type="button" class:active={currentView === "trash"} onclick={() => selectFilterOption("trashView")}>Trash</button>
					</div>
				{/if}
			</div>

			{#if currentView !== "trash"}
				<div class="mode-toggle" role="group" aria-label="Display mode">
					<button type="button" aria-label="Grid view" class:active={visualMode === "grid"} aria-pressed={visualMode === "grid"} onclick={() => (visualMode = "grid")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="3" width="7" height="7"></rect>
							<rect x="14" y="3" width="7" height="7"></rect>
							<rect x="14" y="14" width="7" height="7"></rect>
							<rect x="3" y="14" width="7" height="7"></rect>
						</svg>
					</button>
					<button type="button" aria-label="List view" class:active={visualMode === "list"} aria-pressed={visualMode === "list"} onclick={() => (visualMode = "list")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
							<line x1="8" y1="6" x2="21" y2="6"></line>
							<line x1="8" y1="12" x2="21" y2="12"></line>
							<line x1="8" y1="18" x2="21" y2="18"></line>
							<line x1="3" y1="6" x2="3.01" y2="6"></line>
							<line x1="3" y1="12" x2="3.01" y2="12"></line>
							<line x1="3" y1="18" x2="3.01" y2="18"></line>
						</svg>
					</button>
				</div>
			{/if}
		</div>
	</section>

	{#if currentView === "trash"}
		{#if trashBooks.filter((book) => matchesBookQuery(book, searchQuery)).length > 0}
			<div class="trash-list">
				{#each trashBooks.filter((book) => matchesBookQuery(book, searchQuery)) as book (book.id)}
					<div class="trash-card">
						<div class="trash-cover">
							{#if book.cover}
								<img src={book.cover} alt={book.title} loading="lazy" />
							{:else}
								<div class="no-cover">
									<span class="extension">{book.extension?.toUpperCase() || "?"}</span>
								</div>
							{/if}
						</div>
						<div class="trash-main">
							<h3 title={book.title}>{book.title}</h3>
							<p>{book.author || "Unknown author"}</p>
							<div class="trash-meta">
								<span>Deleted {formatDate(book.deleted_at ?? null)}</span>
								<span>Auto-delete {formatDate(book.trash_expires_at ?? null)}</span>
							</div>
						</div>
						<div class="trash-actions">
							<button class="detail-refetch-btn" onclick={() => handleRestoreBook(book)} disabled={restoringBookId !== null || deletingTrashBookId !== null}>
								{restoringBookId === book.id ? "Restoring..." : "Restore"}
							</button>
							<button class="detail-remove-btn" onclick={() => requestDeleteTrashedBook(book)} disabled={restoringBookId !== null || deletingTrashBookId !== null}>
								{deletingTrashBookId === book.id ? "Deleting..." : "Delete"}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else if !isLoading}
			<div class="empty-state">
				<div class="empty-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
						<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
					</svg>
				</div>
				<h3>Trash is empty</h3>
				<p>Books moved to trash will appear here for 30 days.</p>
			</div>
		{/if}
	{:else}
		{#if (currentView === "library" ? filteredLibraryBooks.length : filteredArchivedBooks.length) > 0}
			{#if visualMode === "grid"}
				<div class="book-grid">
					{#each (currentView === "library" ? filteredLibraryBooks : filteredArchivedBooks) as book (book.id)}
						<div class="book-tile-wrap">
							<button type="button" class="book-tile" aria-label={`Show details for ${book.title}`} onclick={() => openDetailModal(book)}>
								<div class="book-tile-cover">
									{#if book.cover}
										<img src={book.cover} alt={book.title} loading="lazy" />
									{:else}
										<div class="no-cover">
											<span class="extension">{book.extension?.toUpperCase() || "?"}</span>
										</div>
									{/if}
									{#if book.extension}
										<span class={`tile-format ${getFormatBadgeClass(book.extension)}`}>{book.extension.toUpperCase()}</span>
									{/if}
									{#if getProgressPercent(book) > 0 && getProgressPercent(book) < 100}
										<div class="tile-progress-track">
											<div class="tile-progress-fill" style={`width: ${getProgressPercent(book)}%`}></div>
										</div>
									{/if}
								</div>
								<div class="book-tile-meta">
									<p class="tile-title" title={book.title}>{book.title}</p>
									<p class="tile-author">{book.author || "Unknown author"}</p>
									<div class="tile-meta-bottom">
										<div class="tile-rating">
											{#each [1, 2, 3, 4, 5] as star}
												<span class:active={star <= getRoundedRating(book.rating)}>★</span>
											{/each}
										</div>
										{#if (book.shelfIds?.length ?? 0) > 0}
											<div class="tile-shelf-preview">
												{#each (book.shelfIds ?? []).slice(0, 2) as shelfId}
													{@const shelf = shelves.find((item) => item.id === shelfId)}
													{#if shelf}
														<span title={shelf.name}>{shelf.icon}</span>
													{/if}
												{/each}
												{#if (book.shelfIds?.length ?? 0) > 2}
													<span class="tile-shelf-overflow">+{(book.shelfIds?.length ?? 0) - 2}</span>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							</button>
							{#if currentView === "library"}
								<div class="shelf-assign-trigger shelf-assign-trigger-grid">
									<div class="shelf-assign-wrap">
										<button
											type="button"
											class="shelf-assign-btn"
											title="Add to shelf"
											onclick={(event) => {
												event.stopPropagation();
												showShelfAssign = showShelfAssign === book.id ? null : book.id;
											}}
										>
											<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
												<line x1="12" y1="8" x2="12" y2="13"></line>
												<line x1="9.5" y1="10.5" x2="14.5" y2="10.5"></line>
											</svg>
										</button>
										{#if showShelfAssign === book.id}
											<button
												type="button"
												class="menu-backdrop"
												aria-label="Close shelf menu"
												onclick={(event) => {
													event.stopPropagation();
													showShelfAssign = null;
												}}
											></button>
											<div class="shelf-assign-menu shelf-assign-menu-grid">
												<div class="shelf-assign-menu-head">Add to Shelf</div>
												{#if shelves.length === 0}
													<div class="shelf-assign-empty">No shelves yet</div>
												{:else}
													{#each shelves as shelf (shelf.id)}
														{@const isOnShelf = (book.shelfIds ?? []).includes(shelf.id)}
														<button
															type="button"
															class="shelf-assign-item"
															class:on-shelf={isOnShelf}
															onclick={(event) => {
																event.stopPropagation();
																void handleToggleBookShelf(book.id, shelf.id);
															}}
														>
															<span>{shelf.icon}</span>
															<span class="shelf-assign-item-name">{shelf.name}</span>
															{#if isOnShelf}
																<span class="shelf-assign-check">✓</span>
															{/if}
														</button>
													{/each}
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="book-list">
					{#each (currentView === "library" ? filteredLibraryBooks : filteredArchivedBooks) as book (book.id)}
						<div class="book-list-item-wrap">
							<button type="button" class="book-list-item" aria-label={`Show details for ${book.title}`} onclick={() => openDetailModal(book)}>
								<div class="book-list-cover">
									{#if book.cover}
										<img src={book.cover} alt={book.title} loading="lazy" />
									{:else}
										<div class="no-cover">
											<span class="extension">{book.extension?.toUpperCase() || "?"}</span>
										</div>
									{/if}
								</div>
								<div class="book-list-main">
									<p class="tile-title" title={book.title}>{book.title}</p>
									<p class="tile-author">{book.author || "Unknown author"}</p>
									{#if (book.shelfIds?.length ?? 0) > 0}
										<div class="list-shelf-preview">
											{#each (book.shelfIds ?? []).slice(0, 3) as shelfId}
												{@const shelf = shelves.find((item) => item.id === shelfId)}
												{#if shelf}
													<span class="list-shelf-chip">{shelf.icon} {shelf.name}</span>
												{/if}
											{/each}
											{#if (book.shelfIds?.length ?? 0) > 3}
												<span class="list-shelf-overflow">+{(book.shelfIds?.length ?? 0) - 3}</span>
											{/if}
										</div>
									{/if}
								</div>
								<div class="book-list-meta">
									<div class="tile-rating">
										{#each [1, 2, 3, 4, 5] as star}
											<span class:active={star <= getRoundedRating(book.rating)}>★</span>
										{/each}
									</div>
									{#if book.extension}
										<span class={`list-format ${getFormatBadgeClass(book.extension)}`}>{book.extension.toUpperCase()}</span>
									{/if}
									<span class="list-progress-chip">{getProgressPercent(book).toFixed(1)}%</span>
								</div>
							</button>
							{#if currentView === "library"}
								<div class="shelf-assign-trigger shelf-assign-trigger-list">
									<div class="shelf-assign-wrap">
										<button
											type="button"
											class="shelf-assign-btn shelf-assign-btn-list"
											title="Add to shelf"
											onclick={(event) => {
												event.stopPropagation();
												showShelfAssign = showShelfAssign === book.id ? null : book.id;
											}}
										>
											<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
												<line x1="12" y1="8" x2="12" y2="13"></line>
												<line x1="9.5" y1="10.5" x2="14.5" y2="10.5"></line>
											</svg>
										</button>
										{#if showShelfAssign === book.id}
											<button
												type="button"
												class="menu-backdrop"
												aria-label="Close shelf menu"
												onclick={(event) => {
													event.stopPropagation();
													showShelfAssign = null;
												}}
											></button>
											<div class="shelf-assign-menu shelf-assign-menu-list">
												<div class="shelf-assign-menu-head">Add to Shelf</div>
												{#if shelves.length === 0}
													<div class="shelf-assign-empty">No shelves yet</div>
												{:else}
													{#each shelves as shelf (shelf.id)}
														{@const isOnShelf = (book.shelfIds ?? []).includes(shelf.id)}
														<button
															type="button"
															class="shelf-assign-item"
															class:on-shelf={isOnShelf}
															onclick={(event) => {
																event.stopPropagation();
																void handleToggleBookShelf(book.id, shelf.id);
															}}
														>
															<span>{shelf.icon}</span>
															<span class="shelf-assign-item-name">{shelf.name}</span>
															{#if isOnShelf}
																<span class="shelf-assign-check">✓</span>
															{/if}
														</button>
													{/each}
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else if !isLoading}
			<div class="empty-state">
				<div class="empty-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
						<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
					</svg>
				</div>
				{#if currentView === "library"}
					{#if selectedShelfId !== null}
						<h3>No books on this shelf yet</h3>
						<p>Add books using the bookmark icon on each book.</p>
					{:else}
						<h3>Your library is empty</h3>
						<p>Search and download books from Z-Library to build your collection.</p>
						<a href="/search" class="link-btn">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="11" cy="11" r="8"></circle>
								<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
							</svg>
							Go to Search
						</a>
					{/if}
				{:else}
					<h3>No archived books</h3>
					<p>Archive books from the detail view to keep them out of New Books downloads.</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<ConfirmModal
	open={showDeleteTrashModal}
	title="Delete permanently?"
	message={`Delete "${pendingDeleteTrashBook?.title ?? "this book"}" permanently? This removes it from the database and R2 storage.`}
	confirmLabel="Delete Permanently"
	cancelLabel="Cancel"
	danger={true}
	pending={deletingTrashBookId !== null}
	onConfirm={confirmDeleteTrashedBook}
	onCancel={cancelDeleteTrashedBook}
/>

{#if showDetailModal && selectedBook}
	<BookDetailModalShell
		title="Book Details"
		showTabs={true}
		onClose={closeDetailModal}
	>
		{#snippet headerActions()}
					<button
						type="button"
						class="detail-v2-btn detail-v2-btn-secondary"
						onclick={handleRefetchMetadata}
						disabled={isRefetchingMetadata}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 2v6h6"></path>
							<path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
							<path d="M21 22v-6h-6"></path>
							<path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
						</svg>
						<span>{isRefetchingMetadata ? "Refetching..." : "Refetch"}</span>
					</button>
					{#if isEditingMetadata}
						<button
							type="button"
							class="detail-v2-btn detail-v2-btn-primary"
							onclick={saveMetadataEdit}
							disabled={isSavingMetadata}
						>
							{isSavingMetadata ? "Saving..." : "Save"}
						</button>
					{:else}
						<button
							type="button"
							class="detail-v2-btn detail-v2-btn-secondary"
							onclick={startMetadataEdit}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 20h9"></path>
								<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
							</svg>
							<span>Edit</span>
						</button>
					{/if}
		{/snippet}
		{#snippet tabs()}
				<button
					type="button"
					role="tab"
					class:active={activeDetailTab === "overview"}
					aria-selected={activeDetailTab === "overview"}
					onclick={() => (activeDetailTab = "overview")}
				>
					Overview
				</button>
				<button
					type="button"
					role="tab"
					class:active={activeDetailTab === "progress"}
					aria-selected={activeDetailTab === "progress"}
					onclick={() => (activeDetailTab = "progress")}
				>
					Progress
				</button>
				<button
					type="button"
					role="tab"
					class:active={activeDetailTab === "metadata"}
					aria-selected={activeDetailTab === "metadata"}
					onclick={() => (activeDetailTab = "metadata")}
				>
					Metadata
				</button>
				<button
					type="button"
					role="tab"
					class:active={activeDetailTab === "devices"}
					aria-selected={activeDetailTab === "devices"}
					onclick={() => (activeDetailTab = "devices")}
				>
					Devices ({selectedBookDetail?.downloadedDevices.length ?? 0})
				</button>
		{/snippet}
				{#if isDetailLoading}
					<p class="detail-loading">Loading details...</p>
				{:else if detailError}
					<div class="detail-error">{detailError}</div>
				{:else if selectedBookDetail}
					{#if activeDetailTab === "overview"}
						<div class="detail-v2-overview">
							<div class="detail-v2-overview-main">
								<div class="detail-v2-cover">
									{#if metadataDraft.cover || selectedBook.cover}
										<img src={metadataDraft.cover || selectedBook.cover || ""} alt={selectedBookDetail.title} loading="lazy" />
									{:else}
										<div class="no-cover">
											<span class="extension">{selectedBook.extension?.toUpperCase() || "?"}</span>
										</div>
									{/if}
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
										<p class="detail-v2-author">{selectedBookDetail.author || "Unknown author"}</p>
									{/if}

									<div class="detail-v2-chip-row">
										{#if selectedBook.extension}
											<span class={`detail-v2-format-badge ${getFormatBadgeClass(selectedBook.extension)}`}>
												{selectedBook.extension.toUpperCase()}
											</span>
										{/if}
										<span class={`detail-v2-status-badge ${getDetailStatusClass(selectedBookDetail)}`}>
											{getDetailStatusLabel(selectedBookDetail)}
										</span>
										<span class="detail-v2-size">{formatFileSize(selectedBook.filesize)}</span>
									</div>

									<div class="detail-v2-rating">
										<p class="detail-v2-caption">Rating</p>
										<div class="rating-row" role="group" aria-label="Book rating">
											{#each [1, 2, 3, 4, 5] as star}
												<button
													type="button"
													class="rating-star"
													class:active={star <= (selectedBookDetail.rating ?? 0)}
													aria-label={`Set rating to ${star} star${star === 1 ? "" : "s"}`}
													onclick={() => handleSetRating(star)}
													disabled={isUpdatingRating}
												>
													★
												</button>
											{/each}
											{#if (selectedBookDetail.rating ?? 0) > 0}
												<button
													type="button"
													class="rating-clear-btn"
													aria-label="Clear rating"
													onclick={() => handleSetRating(null)}
													disabled={isUpdatingRating}
												>
													Clear
												</button>
											{/if}
										</div>
									</div>

									<div class="detail-v2-progress">
										<div class="detail-v2-progress-head">
											<p class="detail-v2-caption">Reading Progress</p>
											<span>{clampProgress(selectedBookDetail.progressPercent).toFixed(0)}%</span>
										</div>
										<div class="detail-v2-progress-track">
											<div
												class="detail-v2-progress-fill"
												style={`width: ${clampProgress(selectedBookDetail.progressPercent)}%`}
											></div>
										</div>
									</div>
								</div>
							</div>

							<div class="detail-v2-description">
								<p class="detail-v2-caption">Description</p>
								{#if isEditingMetadata}
									<textarea rows="3" class="detail-v2-textarea" bind:value={metadataDraft.description}></textarea>
								{:else}
									<p>{selectedBookDetail.description || "No description available."}</p>
								{/if}
							</div>

							<div class="detail-v2-quick-meta">
								<div>
									<p class="detail-v2-caption">Year</p>
									<strong>{metadataDraft.year || selectedBook.year || "—"}</strong>
								</div>
								<div>
									<p class="detail-v2-caption">Pages</p>
									<strong>{metadataDraft.pages || selectedBookDetail.pages || "—"}</strong>
								</div>
								<div>
									<p class="detail-v2-caption">Language</p>
									<strong>{metadataDraft.language || selectedBook.language || "—"}</strong>
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
								<div class="detail-v2-shelves-head">
									<p class="detail-v2-caption">Shelves</p>
									<span>{selectedBookDetail.shelfIds.length} selected</span>
								</div>
								{#if shelves.length === 0}
									<p class="detail-muted">Create a shelf above to organize this book.</p>
								{:else}
									<div class="detail-v2-shelf-list">
										{#each shelves as shelf (shelf.id)}
											<button
												type="button"
												class="detail-v2-shelf-item"
												class:active={selectedBookDetail.shelfIds.includes(shelf.id)}
												onclick={() => void handleToggleShelfAssignment(shelf.id)}
												disabled={isUpdatingShelves}
											>
												<span class="detail-v2-shelf-icon">{shelf.icon}</span>
												<span>{shelf.name}</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<div class="detail-v2-actions">
								<button class="detail-v2-btn detail-v2-btn-secondary" onclick={handleDownloadFromLibrary} disabled={isDownloadingLibraryFile}>
									{isDownloadingLibraryFile ? "Downloading..." : "Download"}
								</button>
								<button class="detail-v2-btn detail-v2-btn-secondary" onclick={handleToggleArchiveState} disabled={isUpdatingArchiveState}>
									{isUpdatingArchiveState ? "Saving..." : selectedBookDetail.isArchived ? "Unarchive" : "Archive"}
								</button>
								<button class="detail-v2-btn detail-v2-btn-secondary" onclick={handleToggleExcludeFromNewBooks} disabled={isUpdatingNewBooksExclusion || selectedBookDetail.isArchived}>
									{isUpdatingNewBooksExclusion ? "Saving..." : selectedBookDetail.excludeFromNewBooks ? "Include In New" : "Exclude From New"}
								</button>
								<button class="detail-v2-btn detail-v2-btn-secondary" onclick={handleToggleReadState} disabled={isUpdatingReadState}>
									{isUpdatingReadState ? "Saving..." : selectedBookDetail.isRead ? "Mark Unread" : "Mark Read"}
								</button>
								{#if selectedBook.isDownloaded}
									<button class="detail-v2-btn detail-v2-btn-secondary" onclick={openResetFromDetail}>
										Reset Download
									</button>
								{/if}
								<button class="detail-v2-btn detail-v2-btn-danger" onclick={handleMoveToTrash} disabled={isMovingToTrash}>
									{isMovingToTrash ? "Moving..." : "Move To Trash"}
								</button>
							</div>
						</div>
					{:else if activeDetailTab === "progress"}
						<div class="detail-v2-progress-tab">
							<div class="detail-v2-current-progress">
								<div class="detail-v2-progress-summary">
									<h3>Current Progress</h3>
									<span>{clampProgress(selectedBookDetail.progressPercent).toFixed(0)}%</span>
								</div>
								<div class="detail-v2-progress-track">
									<div
										class="detail-v2-progress-fill"
										style={`width: ${clampProgress(selectedBookDetail.progressPercent)}%`}
									></div>
								</div>
								{#if getCurrentPage(selectedBookDetail.progressPercent, selectedBookDetail.pages) !== null}
									<p class="detail-muted">
										~{getCurrentPage(selectedBookDetail.progressPercent, selectedBookDetail.pages)} of {selectedBookDetail.pages} pages read
									</p>
								{/if}
							</div>

							<div class="detail-v2-history">
								<div class="detail-v2-history-head">
									<p class="detail-v2-caption">Progress History ({progressHistory.length} entries)</p>
									{#if hasMoreProgressHistory}
										<button type="button" onclick={() => (showProgressHistory = !showProgressHistory)}>
											{showProgressHistory ? "Show Less" : `Show All (${progressHistory.length})`}
										</button>
									{/if}
								</div>

								{#if isProgressHistoryLoading}
									<p class="detail-muted">Loading progress history...</p>
								{:else if progressHistoryError}
									<p class="detail-error">{progressHistoryError}</p>
								{:else if progressHistory.length === 0}
									<p class="detail-muted">No progress history yet.</p>
								{:else}
									<ul class="detail-v2-history-list">
										{#each visibleProgressHistory as entry, index (`${entry.recordedAt}-${entry.progressPercent}-${index}`)}
											<li>
												<div class="detail-v2-history-dot"></div>
												<div class="detail-v2-history-card">
													<div class="detail-v2-history-row">
														<span>{formatDateTime(entry.recordedAt)}</span>
														<span>{clampProgress(entry.progressPercent).toFixed(1)}%</span>
													</div>
													<div class="detail-v2-progress-track">
														<div
															class="detail-v2-progress-fill"
															style={`width: ${clampProgress(entry.progressPercent)}%`}
														></div>
													</div>
													{#if getProgressHistoryPageRange(progressHistory, index, selectedBookDetail.pages)}
														<span class="detail-v2-history-range">
															{getProgressHistoryPageRange(progressHistory, index, selectedBookDetail.pages)}
														</span>
													{/if}
												</div>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</div>
					{:else if activeDetailTab === "metadata"}
						<div class="detail-v2-metadata-tab">
							<div class="detail-v2-metadata-cover">
								<p class="detail-v2-caption">Cover</p>
								<div>
									{#if metadataDraft.cover || selectedBook.cover}
										<img src={metadataDraft.cover || selectedBook.cover || ""} alt={selectedBookDetail.title} />
									{:else}
										<div class="no-cover"><span class="extension">?</span></div>
									{/if}
									<span>{metadataDraft.cover || selectedBook.cover || "No cover URL"}</span>
								</div>
							</div>

							<div class="detail-v2-metadata-description">
								<p class="detail-v2-caption">Description</p>
								{#if isEditingMetadata}
									<textarea rows="4" class="detail-v2-textarea" bind:value={metadataDraft.description}></textarea>
								{:else}
									<p>{selectedBookDetail.description || "No description available."}</p>
								{/if}
							</div>

							<div class="detail-v2-metadata-grid">
								<div><p class="detail-v2-caption">Title</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.title} />{:else}<p>{selectedBookDetail.title}</p>{/if}</div>
								<div><p class="detail-v2-caption">Author</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.author} />{:else}<p>{selectedBookDetail.author || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Publisher</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.publisher} />{:else}<p>{selectedBookDetail.publisher || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Series</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.series} />{:else}<p>{selectedBookDetail.series || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Volume</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.volume} />{:else}<p>{selectedBookDetail.volume || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Edition</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.edition} />{:else}<p>{selectedBookDetail.edition || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Identifier</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.identifier} />{:else}<p>{selectedBookDetail.identifier || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Year</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.year} />{:else}<p>{selectedBook.year || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Pages</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.pages} />{:else}<p>{selectedBookDetail.pages || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Language</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.language} />{:else}<p>{selectedBook.language || "—"}</p>{/if}</div>
								<div>
									<p class="detail-v2-caption">Google Books ID</p>
									{#if isEditingMetadata}
										<input class="detail-v2-input" bind:value={metadataDraft.googleBooksId} />
									{:else if selectedBookDetail.googleBooksId}
										<p>
											<a class="detail-v2-meta-link" href={toGoogleBooksUrl(selectedBookDetail.googleBooksId)} target="_blank" rel="noopener noreferrer">
												{selectedBookDetail.googleBooksId}
											</a>
										</p>
									{:else}
										<p>—</p>
									{/if}
								</div>
								<div>
									<p class="detail-v2-caption">Open Library Key</p>
									{#if isEditingMetadata}
										<input class="detail-v2-input" bind:value={metadataDraft.openLibraryKey} />
									{:else if selectedBookDetail.openLibraryKey}
										<p>
											<a class="detail-v2-meta-link" href={toOpenLibraryUrl(selectedBookDetail.openLibraryKey)} target="_blank" rel="noopener noreferrer">
												{selectedBookDetail.openLibraryKey}
											</a>
										</p>
									{:else}
										<p>—</p>
									{/if}
								</div>
								<div><p class="detail-v2-caption">Amazon ASIN</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.amazonAsin} />{:else}<p>{selectedBookDetail.amazonAsin || "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">External Rating</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.externalRating} />{:else}<p>{selectedBookDetail.externalRating !== null ? `${selectedBookDetail.externalRating}/5` : "—"}</p>{/if}</div>
								<div><p class="detail-v2-caption">Rating Count</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.externalRatingCount} />{:else}<p>{selectedBookDetail.externalRatingCount ? selectedBookDetail.externalRatingCount.toLocaleString() : "—"}</p>{/if}</div>
							</div>
						</div>
					{:else}
						<div class="detail-v2-devices-tab">
							<div class="detail-v2-devices-head">
								<h3>Downloaded Devices</h3>
								<span>{selectedBookDetail.downloadedDevices.length} device{selectedBookDetail.downloadedDevices.length !== 1 ? "s" : ""}</span>
							</div>
							{#if selectedBookDetail.downloadedDevices.length === 0}
								<p class="detail-muted">No device downloads tracked.</p>
							{:else}
								<div class="detail-v2-device-list">
									{#each selectedBookDetail.downloadedDevices as device}
										<div class="detail-v2-device-row">
											<div class="detail-v2-device-icon">
												<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
													<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
													<line x1="12" y1="18" x2="12.01" y2="18"></line>
												</svg>
											</div>
											<div class="detail-v2-device-text">
												<p>{device}</p>
												<span>Downloaded device</span>
											</div>
											<button
												type="button"
												class="detail-v2-device-remove"
												onclick={() => handleRemoveDeviceDownload(device)}
												disabled={removingDeviceId !== null}
											>
												{removingDeviceId === device ? "Removing..." : "Remove"}
											</button>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				{/if}
	</BookDetailModalShell>
{/if}

<!-- Confirmation Modal -->
{#if showConfirmModal && bookToReset}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="modal-overlay" 
		onclick={closeResetModal}
		onkeydown={(e) => e.key === 'Escape' && closeResetModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-content" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<div class="modal-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
					<path d="M3 3v5h5"></path>
				</svg>
			</div>
			<h3 id="modal-title">Reset Download Status</h3>
			<p class="modal-description">
				This will mark <strong>"{bookToReset.title}"</strong> as not downloaded. 
				The book will remain in your library—only the download status will be reset.
			</p>
			<div class="modal-actions">
				<button class="modal-btn cancel" onclick={closeResetModal}>Cancel</button>
				<button class="modal-btn confirm" onclick={confirmResetStatus}>Reset Status</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.library-page {
		padding: 1rem 0 1.4rem;
		display: grid;
		gap: 1.5rem;
		color: var(--color-text-primary);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.stat-card {
		background: #161921;
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 1rem;
		display: grid;
		gap: 0.25rem;
	}

	.stat-card p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.stat-card h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 500;
		line-height: 1.25;
		color: var(--color-text-primary);
	}

	.stat-card h2.accent-reading {
		color: #c9a962;
	}

	.stat-card h2.accent-unread {
		color: #60a5fa;
	}

	.stat-card h2.accent-read {
		color: #4ade80;
	}

	.toolbar-row {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.search-wrap {
		width: 100%;
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.625rem 0.875rem;
		background: #1a1d27;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		color: var(--color-text-muted);
	}

	.search-wrap input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-text-primary);
		font-size: 0.875rem;
		font-family: inherit;
	}

	.search-wrap input::placeholder {
		color: color-mix(in oklab, var(--color-text-muted), transparent 45%);
	}

	.search-wrap input:focus {
		outline: none;
	}

	.toolbar-actions {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.import-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		border-radius: 0.5rem;
		border: 0;
		background: #c9a962;
		color: #0d0f14;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.import-btn:hover {
		opacity: 0.9;
	}

	.import-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.upload-input {
		display: none;
	}

	.menu-wrap {
		position: relative;
	}

	.control-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: #1e2230;
		color: #c4c1bb;
		font-size: 0.875rem;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.control-btn:hover {
		background: #252a3b;
	}

	.mode-toggle {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem;
		background: #1e2230;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		gap: 0.125rem;
	}

	.mode-toggle button {
		width: 2.125rem;
		height: 2.125rem;
		display: grid;
		place-items: center;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.mode-toggle button.active {
		background: #161921;
		color: var(--color-text-primary);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}

	.menu-backdrop {
		position: fixed;
		inset: 0;
		background: transparent;
		border: 0;
		padding: 0;
		margin: 0;
		z-index: 30;
	}

	.menu-popover {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		min-width: 10.5rem;
		padding: 0.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: 0 18px 36px rgba(0, 0, 0, 0.4);
		z-index: 40;
		display: grid;
		gap: 0.1rem;
	}

	.menu-popover button {
		text-align: left;
		padding: 0.5rem 0.625rem;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.menu-popover button:hover {
		background: color-mix(in oklab, var(--color-secondary), transparent 20%);
		color: var(--color-text-primary);
	}

	.menu-popover button.active {
		color: var(--color-primary);
		background: color-mix(in oklab, var(--color-primary), transparent 90%);
	}

	.menu-separator {
		height: 1px;
		background: var(--color-border);
		margin: 0.2rem 0.25rem;
	}

	.filter-popover {
		min-width: 8.8rem;
	}

	.book-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.book-tile-wrap {
		position: relative;
	}

	.book-tile {
		background: #161921;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.75rem;
		text-align: left;
		padding: 0;
		color: inherit;
		cursor: pointer;
		overflow: hidden;
		transition: border-color 0.22s ease, transform 0.22s ease;
	}

	.book-tile:hover {
		border-color: color-mix(in oklab, var(--color-primary), transparent 70%);
		transform: translateY(-1px);
	}

	.book-tile-cover {
		position: relative;
		aspect-ratio: 3 / 4;
		overflow: hidden;
		background: color-mix(in oklab, var(--color-surface), black 8%);
	}

	.book-tile-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.5s ease;
	}

	.book-tile:hover .book-tile-cover img {
		transform: scale(1.05);
	}

	.no-cover {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		background: #242a37;
	}

	.no-cover .extension {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.tile-format {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: inline-flex;
		align-items: center;
		padding: 0.22rem 0.5rem;
		border-radius: 0.45rem;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1.2;
		border: none;
	}

	.tile-format.epub {
		background: #1a2a3a;
		color: #60a5fa;
	}

	.tile-format.pdf {
		background: #2a1a2a;
		color: #c084fc;
	}

	.tile-format.mobi {
		background: #2a2518;
		color: #c9a962;
	}

	.tile-progress-track {
		position: absolute;
		left: 0.625rem;
		right: 0.625rem;
		bottom: 0.625rem;
		height: 0.5rem;
		border-radius: 999px;
		background: #1e2230;
		overflow: hidden;
	}

	.tile-progress-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #c9a962, #e0c878);
	}

	.book-tile-meta {
		padding: 0.75rem;
		display: grid;
		gap: 0.2rem;
	}

	.tile-title {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-primary);
		line-height: 1.25;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-author {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-meta-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.tile-rating {
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
	}

	.tile-rating span {
		font-size: 0.8rem;
		color: #3a3d4a;
	}

	.tile-rating span.active {
		color: #c9a962;
	}

	.tile-shelf-preview {
		display: inline-flex;
		align-items: center;
		gap: 0.16rem;
		font-size: 0.72rem;
		color: var(--color-text-muted);
	}

	.tile-shelf-overflow {
		font-size: 0.64rem;
		color: var(--color-text-muted);
	}

	.shelf-assign-trigger {
		position: absolute;
		z-index: 12;
	}

	.shelf-assign-trigger-grid {
		left: 0.5rem;
		top: 0.5rem;
	}

	.shelf-assign-trigger-list {
		right: 0.55rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.shelf-assign-wrap {
		position: relative;
	}

	.shelf-assign-btn {
		width: 1.52rem;
		height: 1.52rem;
		border-radius: 0.42rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(22, 25, 33, 0.88);
		color: var(--color-text-secondary);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.book-tile-wrap:hover .shelf-assign-btn,
	.book-list-item-wrap:hover .shelf-assign-btn {
		opacity: 1;
	}

	.shelf-assign-btn:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.shelf-assign-btn-list {
		background: #161921;
	}

	.shelf-assign-menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		min-width: 11.2rem;
		padding: 0.35rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: 0 18px 36px rgba(0, 0, 0, 0.42);
		z-index: 50;
		display: grid;
		gap: 0.15rem;
	}

	.shelf-assign-menu-grid {
		left: 0;
	}

	.shelf-assign-menu-list {
		right: 0;
	}

	.shelf-assign-menu-head {
		padding: 0.25rem 0.4rem 0.35rem;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.shelf-assign-empty {
		padding: 0.38rem 0.4rem;
		font-size: 0.72rem;
		color: var(--color-text-muted);
	}

	.shelf-assign-item {
		width: 100%;
		border: 1px solid transparent;
		background: transparent;
		border-radius: 0.38rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.38rem 0.45rem;
		font-size: 0.74rem;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.shelf-assign-item:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-text-primary);
	}

	.shelf-assign-item.on-shelf {
		background: color-mix(in oklab, var(--color-primary), transparent 90%);
		border-color: color-mix(in oklab, var(--color-primary), transparent 68%);
		color: var(--color-text-primary);
	}

	.shelf-assign-item-name {
		flex: 1;
		text-align: left;
	}

	.shelf-assign-check {
		font-size: 0.68rem;
		color: var(--color-primary);
	}

	.book-list {
		display: grid;
		gap: 0.62rem;
	}

	.book-list-item-wrap {
		position: relative;
	}

	.book-list-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-border);
		background: #161921;
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.2s ease, transform 0.2s ease;
	}

	.book-list-item:hover {
		border-color: color-mix(in oklab, var(--color-primary), transparent 70%);
		transform: translateY(-1px);
	}

	.book-list-cover {
		width: 3rem;
		height: 4rem;
		border-radius: 0.5rem;
		overflow: hidden;
		background: color-mix(in oklab, var(--color-surface), black 8%);
		flex-shrink: 0;
	}

	.book-list-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.book-list-main {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.1rem;
	}

	.list-shelf-preview {
		display: inline-flex;
		align-items: center;
		gap: 0.24rem;
		flex-wrap: wrap;
		margin-top: 0.16rem;
	}

	.list-shelf-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.35rem;
		border-radius: 999px;
		font-size: 0.62rem;
		background: rgba(255, 255, 255, 0.05);
		color: var(--color-text-muted);
	}

	.list-shelf-overflow {
		font-size: 0.64rem;
		color: var(--color-text-muted);
	}

	.book-list-meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-left: auto;
	}

	.list-format {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.45rem;
		border-radius: 0.38rem;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.list-format.epub {
		background: #1a2a3a;
		color: #60a5fa;
	}

	.list-format.pdf {
		background: #2a1a2a;
		color: #c084fc;
	}

	.list-format.mobi {
		background: #2a2518;
		color: #c9a962;
	}

	.list-progress-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.42rem;
		border-radius: 999px;
		font-size: 0.66rem;
		font-weight: 700;
		background: #2a2518;
		color: #c9a962;
		border: 1px solid rgba(201, 169, 98, 0.3);
	}

	.trash-list {
		display: grid;
		gap: 0.78rem;
	}

	.trash-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(196, 68, 58, 0.35);
		background: rgba(196, 68, 58, 0.13);
	}

	.trash-cover {
		width: 3.5rem;
		height: 4.9rem;
		flex-shrink: 0;
		border-radius: 0.5rem;
		overflow: hidden;
		background: color-mix(in oklab, var(--color-surface), black 8%);
	}

	.trash-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.trash-main {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.24rem;
	}

	.trash-main h3 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trash-main p {
		margin: 0;
		font-size: 0.75rem;
		color: #d4a3a0;
	}

	.trash-meta {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
		font-size: 0.68rem;
		color: #e8b7b2;
	}

	.trash-actions {
		display: grid;
		gap: 0.34rem;
		justify-items: end;
	}

	.empty-state {
		display: grid;
		justify-items: center;
		text-align: center;
		padding: 2rem 1rem;
		border-radius: 0.75rem;
		border: 1px dashed rgba(255, 255, 255, 0.18);
		background: var(--color-surface);
	}

	.empty-icon {
		width: 76px;
		height: 76px;
		display: grid;
		place-items: center;
		border-radius: 1rem;
		background: #1b2131;
		color: var(--color-text-muted);
		margin-bottom: 0.72rem;
	}

	.empty-state h3 {
		margin: 0 0 0.26rem;
		font-size: 1.08rem;
	}

	.empty-state p {
		margin: 0 0 0.92rem;
		font-size: 0.84rem;
		color: var(--color-text-muted);
	}

	.link-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.34rem;
		padding: 0.46rem 0.72rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in oklab, var(--color-primary), transparent 65%);
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		text-decoration: none;
		font-size: 0.78rem;
		font-weight: 600;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.72rem 0.84rem;
		border-radius: 0.7rem;
		border: 1px solid rgba(196, 68, 58, 0.45);
		background: rgba(196, 68, 58, 0.18);
		font-size: 0.82rem;
		color: #ffb4ad;
	}

	.error p {
		margin: 0;
		flex: 1;
	}

	.error button {
		padding: 0.4rem 0.64rem;
		border-radius: 0.52rem;
		border: 1px solid rgba(196, 68, 58, 0.4);
		background: rgba(196, 68, 58, 0.22);
		color: #ffb4ad;
		font-size: 0.74rem;
		cursor: pointer;
	}

	@media (min-width: 640px) {
		.toolbar-row {
			flex-direction: row;
		}

		.toolbar-actions {
			width: auto;
		}

		.book-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 920px) {
		.book-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.stats-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (min-width: 1280px) {
		.book-grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}

	@media (max-width: 860px) {
		.search-wrap {
			min-width: 0;
		}

		.book-list-item,
		.trash-card {
			flex-wrap: wrap;
		}

		.book-list-meta {
			margin-left: 0;
		}
	}

	@media (max-width: 700px) {
		.library-page {
			padding-top: 0.75rem;
			gap: 0.95rem;
		}

		.toolbar-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			width: 100%;
		}

		.import-btn,
		.control-btn,
		.mode-toggle {
			width: 100%;
			justify-content: center;
		}

		.book-grid {
			grid-template-columns: repeat(1, minmax(0, 1fr));
		}

		.trash-actions {
			width: 100%;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			justify-items: stretch;
		}

		.error {
			flex-direction: column;
			align-items: stretch;
		}
	}

	@media (max-width: 420px) {
		.toolbar-actions {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.detail-modal-content.detail-v2-shell {
		width: 100%;
		max-width: 48rem;
		max-height: 90vh;
		padding: 0;
		border-radius: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 0;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	}

	.detail-v2-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.detail-v2-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 500;
		line-height: 1.5;
	}

	.detail-v2-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.detail-v2-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.5;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
	}

	.detail-v2-btn-secondary {
		background: var(--color-secondary);
		color: var(--color-text-secondary);
	}

	.detail-v2-btn-secondary:hover {
		background: color-mix(in oklab, var(--color-secondary), white 8%);
	}

	.detail-v2-btn-primary {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		border-color: transparent;
	}

	.detail-v2-btn-danger {
		background: rgba(196, 68, 58, 0.16);
		border-color: rgba(196, 68, 58, 0.38);
		color: #ffb4ad;
	}

	.detail-v2-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.detail-v2-close-btn {
		padding: 0.375rem;
		width: auto;
		height: auto;
		display: grid;
		place-items: center;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.detail-v2-close-btn:hover {
		background: var(--color-secondary);
		color: var(--color-text-primary);
	}

	.detail-v2-tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--color-border);
		overflow-x: auto;
		flex-shrink: 0;
	}

	.detail-v2-tabs button {
		padding: 0.625rem 0.75rem;
		border: none;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.5;
		font-family: inherit;
		white-space: nowrap;
		cursor: pointer;
		transition: border-color 0.2s ease, color 0.2s ease;
	}

	.detail-v2-tabs button.active {
		border-bottom-color: var(--color-primary);
		color: var(--color-text-primary);
	}

	.detail-v2-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 1.5rem;
	}

	.detail-v2-overview,
	.detail-v2-progress-tab,
	.detail-v2-metadata-tab,
	.detail-v2-devices-tab {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.detail-v2-overview-main {
		display: flex;
		gap: 1.5rem;
	}

	.detail-v2-cover {
		width: 10rem;
		height: 14rem;
		border-radius: 0.75rem;
		overflow: hidden;
		background: var(--color-input-background);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
		flex-shrink: 0;
	}

	.detail-v2-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.detail-v2-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.detail-v2-info h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 500;
		line-height: 1.5;
	}

	.detail-v2-author {
		margin: 0;
		font-size: 1rem;
		color: var(--color-text-muted);
	}

	.detail-v2-chip-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.detail-v2-format-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1.2;
	}

	.detail-v2-format-badge.epub {
		background: #1a2a3a;
		color: #60a5fa;
	}

	.detail-v2-format-badge.pdf {
		background: #2a1a2a;
		color: #c084fc;
	}

	.detail-v2-format-badge.mobi {
		background: #2a2518;
		color: #c9a962;
	}

	.detail-v2-status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.625rem;
		border-radius: 999px;
		font-size: 0.75rem;
		letter-spacing: 0.01em;
		text-transform: capitalize;
	}

	.detail-v2-status-badge.reading {
		background: #2a2518;
		color: #c9a962;
	}

	.detail-v2-status-badge.read {
		background: #1a2a1a;
		color: #4ade80;
	}

	.detail-v2-status-badge.unread {
		background: #2a2d3a;
		color: #a0aec0;
	}

	.detail-v2-size {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.detail-v2-caption {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.detail-v2-rating .detail-v2-caption,
	.detail-v2-progress .detail-v2-caption {
		margin-bottom: 0.25rem;
		display: block;
	}

	.rating-row {
		display: flex;
		gap: 0.125rem;
		align-items: center;
	}

	.rating-star {
		width: auto;
		height: auto;
		padding: 0;
		border: 0;
		background: transparent;
		color: #3a3d4a;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.rating-star.active {
		color: #c9a962;
		border: 0;
	}

	.rating-clear-btn {
		margin-left: 0.4rem;
		padding: 0.14rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: #1e2230;
		color: var(--color-text-muted);
		font-size: 0.68rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.rating-clear-btn:hover:not(:disabled) {
		background: #252a3b;
		color: var(--color-text-primary);
	}

	.rating-clear-btn:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.detail-v2-progress-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.detail-v2-progress-head span {
		font-size: 0.75rem;
		color: var(--color-text-primary);
		font-weight: 500;
	}

	.detail-v2-progress-track {
		height: 0.375rem;
		border-radius: 999px;
		overflow: hidden;
		background: #1e2230;
	}

	.detail-v2-progress-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #c9a962, #e0c878);
	}

	.detail-v2-description p,
	.detail-v2-metadata-description p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.52;
		color: var(--color-text-secondary);
	}

	.detail-v2-quick-meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.detail-v2-quick-meta > div {
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: rgba(30, 34, 48, 0.5);
		display: grid;
		gap: 0.16rem;
	}

	.detail-v2-quick-meta strong {
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--color-text-primary);
	}

	.detail-v2-external-rating {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: rgba(30, 34, 48, 0.3);
	}

	.detail-v2-star {
		color: #c9a962;
	}

	.detail-v2-external-rating span:nth-child(2) {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.detail-v2-external-rating span:nth-child(3) {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.detail-v2-shelves {
		display: grid;
		gap: 0.55rem;
	}

	.detail-v2-shelves-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.detail-v2-shelves-head span {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.detail-v2-shelf-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.detail-v2-shelf-item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.42rem 0.68rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #1a1f2d;
		color: var(--color-text-secondary);
		font-size: 0.78rem;
		font-family: inherit;
		cursor: pointer;
	}

	.detail-v2-shelf-item.active {
		background: color-mix(in oklab, var(--color-primary), transparent 88%);
		border-color: color-mix(in oklab, var(--color-primary), transparent 65%);
		color: var(--color-primary);
	}

	.detail-v2-shelf-item:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.detail-v2-shelf-icon {
		font-size: 0.84rem;
	}

	.detail-v2-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.detail-v2-current-progress {
		padding: 1rem;
		border-radius: 0.75rem;
		background: rgba(30, 34, 48, 0.3);
		display: grid;
		gap: 0.45rem;
	}

	.detail-v2-progress-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.detail-v2-progress-summary h3,
	.detail-v2-devices-head h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.detail-v2-progress-summary span {
		font-size: 1.5rem;
		font-weight: 500;
		color: #c9a962;
	}

	.detail-v2-history-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.detail-v2-history-head button {
		border: none;
		background: transparent;
		color: #c9a962;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.detail-v2-history-list {
		list-style: none;
		margin: 0;
		padding: 0 0 0 1.1rem;
		display: grid;
		gap: 0.75rem;
		position: relative;
	}

	.detail-v2-history-list::before {
		content: "";
		position: absolute;
		left: 0.35rem;
		top: 0.6rem;
		bottom: 0.6rem;
		width: 1px;
		background: var(--color-border);
	}

	.detail-v2-history-list li {
		position: relative;
	}

	.detail-v2-history-dot {
		position: absolute;
		left: -0.78rem;
		top: 0.98rem;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--color-surface);
		border: 2px solid rgba(122, 120, 114, 0.35);
	}

	.detail-v2-history-card {
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: rgba(30, 34, 48, 0.3);
		display: grid;
		gap: 0.34rem;
	}

	.detail-v2-history-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.detail-v2-history-row span:last-child {
		color: var(--color-text-primary);
		font-weight: 600;
	}

	.detail-v2-history-range {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.detail-v2-metadata-cover > div {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: rgba(30, 34, 48, 0.3);
	}

	.detail-v2-metadata-cover img {
		width: 3rem;
		height: 4rem;
		border-radius: 0.44rem;
		object-fit: cover;
	}

	.detail-v2-metadata-cover span {
		min-width: 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		word-break: break-all;
	}

	.detail-v2-metadata-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.detail-v2-metadata-grid > div {
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: rgba(30, 34, 48, 0.3);
		display: grid;
		gap: 0.18rem;
	}

	.detail-v2-metadata-grid p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-primary);
		line-height: 1.45;
	}

	.detail-v2-meta-link {
		color: #c9a962;
		text-decoration: underline;
		text-underline-offset: 0.16rem;
		word-break: break-word;
	}

	.detail-v2-meta-link:hover {
		color: #e5c987;
	}

	.detail-v2-devices-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.detail-v2-devices-head span {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.detail-v2-device-list {
		display: grid;
		gap: 0.52rem;
	}

	.detail-v2-device-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: rgba(30, 34, 48, 0.3);
	}

	.detail-v2-device-icon {
		width: 2.2rem;
		height: 2.2rem;
		display: grid;
		place-items: center;
		border-radius: 0.6rem;
		background: #232838;
		color: var(--color-text-muted);
	}

	.detail-v2-device-text {
		flex: 1;
		min-width: 0;
	}

	.detail-v2-device-text p {
		margin: 0 0 0.12rem;
		font-size: 0.875rem;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.detail-v2-device-text span {
		font-size: 0.74rem;
		color: var(--color-text-muted);
	}

	.detail-v2-device-remove {
		padding: 0.38rem 0.62rem;
		border-radius: 0.55rem;
		border: 1px solid rgba(196, 68, 58, 0.38);
		background: rgba(196, 68, 58, 0.16);
		color: #ffb4ad;
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
	}

	.detail-v2-input,
	.detail-v2-textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-input-background);
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: 0.875rem;
	}

	.detail-v2-input:focus,
	.detail-v2-textarea:focus {
		outline: none;
		border-color: rgba(201, 169, 98, 0.56);
		box-shadow: 0 0 0 2px rgba(201, 169, 98, 0.12);
	}

	.detail-v2-title-input {
		font-size: 1.5rem;
		font-weight: 500;
		line-height: 1.5;
	}

	@media (max-width: 900px) {
		.detail-modal-content.detail-v2-shell {
			max-height: calc(100dvh - 1rem);
		}

		.detail-v2-header {
			padding: 0.875rem 1rem;
		}

		.detail-v2-header h2 {
			font-size: 1.125rem;
		}

		.detail-v2-body {
			padding: 1rem;
		}

		.detail-v2-overview-main {
			flex-direction: column;
		}

		.detail-v2-cover {
			width: 10rem;
			height: 14rem;
		}

		.detail-v2-quick-meta {
			grid-template-columns: minmax(0, 1fr);
		}

		.detail-v2-metadata-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 640px) {
		.detail-v2-header {
			flex-direction: column;
			align-items: stretch;
		}

		.detail-v2-header-actions {
			justify-content: flex-end;
			flex-wrap: wrap;
		}

		.detail-v2-btn {
			padding: 0.375rem 0.625rem;
			font-size: 0.8125rem;
		}

		.detail-v2-actions {
			flex-direction: column;
		}

		.detail-v2-actions .detail-v2-btn {
			width: 100%;
			justify-content: center;
		}

		.detail-v2-device-row {
			flex-wrap: wrap;
		}
	}

	.detail-modal-overlay,
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		padding: 0.85rem;
		z-index: 1200;
	}

	.detail-modal-content {
		width: min(960px, 100%);
		max-height: calc(100dvh - 1.6rem);
		overflow-y: auto;
		border-radius: 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 0.9rem;
		display: grid;
		gap: 0.58rem;
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 0.6rem;
		padding-bottom: 0.52rem;
		border-bottom: 1px solid var(--color-border);
	}

	.detail-header h3 {
		margin: 0;
		font-size: 1.06rem;
		font-weight: 600;
	}

	.detail-close-btn {
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.detail-author {
		margin: 0;
		font-size: 0.84rem;
		color: var(--color-text-muted);
	}

	.detail-loading,
	.detail-muted {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.detail-error {
		padding: 0.54rem 0.62rem;
		border-radius: 0.54rem;
		border: 1px solid rgba(196, 68, 58, 0.45);
		background: rgba(196, 68, 58, 0.16);
		font-size: 0.78rem;
		color: #ffb4ad;
	}

	.detail-section {
		padding: 0.68rem;
		border-radius: 0.66rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		display: grid;
		gap: 0.45rem;
	}


	.metadata-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.4rem;
	}

	.metadata-edit-actions {
		display: inline-flex;
		gap: 0.3rem;
	}

	.metadata-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.metadata-item {
		padding: 0.4rem 0.45rem;
		border-radius: 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: #202431;
		display: grid;
		gap: 0.14rem;
	}

	.metadata-item span {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}


	.metadata-description {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--color-text-secondary);
		white-space: pre-wrap;
	}

	.metadata-edit-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.metadata-edit-grid label {
		display: grid;
		gap: 0.15rem;
	}

	.metadata-edit-full {
		grid-column: 1 / -1;
	}

	.progress-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.progress-track {
		flex: 1;
		height: 8px;
		border-radius: 999px;
		overflow: hidden;
		background: #232834;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #c9a962, #e0c878);
	}

	.progress-value {
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		min-width: 3.8rem;
		text-align: right;
	}

	.history-header {
		margin: 0;
	}

	.progress-history-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.26rem;
	}


	.progress-history-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.4rem;
	}

	.progress-history-percent {
		font-size: 0.74rem;
		font-weight: 600;
	}

	.progress-history-time,
	.progress-history-range {
		font-size: 0.68rem;
		color: var(--color-text-muted);
	}

	.read-state-row {
		display: flex;
		align-items: center;
		gap: 0.46rem;
		flex-wrap: wrap;
	}

	.read-state-label {
		font-size: 0.74rem;
		color: var(--color-text-muted);
	}

	.exclude-new-books-row {
		display: inline-flex;
		align-items: center;
		gap: 0.36rem;
		font-size: 0.74rem;
		color: var(--color-text-secondary);
	}


	.rating-row {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		flex-wrap: wrap;
	}

	.rating-star {
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 0.44rem;
		border: 1px solid var(--color-border);
		background: #202431;
		color: #545e6e;
		font-size: 0.95rem;
		cursor: pointer;
	}

	.rating-star.active {
		color: #c9a962;
		border-color: rgba(201, 169, 98, 0.35);
	}

	.rating-clear {
		padding: 0.3rem 0.46rem;
		border-radius: 0.44rem;
		border: 1px solid var(--color-border);
		background: #202431;
		color: var(--color-text-secondary);
		font-size: 0.7rem;
		cursor: pointer;
	}

	.device-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.26rem;
	}


	.device-remove-btn {
		padding: 0.12rem 0.28rem;
		border-radius: 0.36rem;
		border: 1px solid rgba(196, 68, 58, 0.42);
		background: rgba(196, 68, 58, 0.2);
		color: #ffb4ad;
		font-size: 0.62rem;
		cursor: pointer;
	}

	.detail-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.detail-download-btn,
	.detail-refetch-btn,
	.detail-reset-btn,
	.detail-remove-btn,
	.modal-btn {
		padding: 0.38rem 0.58rem;
		border-radius: 0.48rem;
		border: 1px solid var(--color-border);
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
	}

	.detail-download-btn {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	.detail-refetch-btn {
		background: #232834;
		color: var(--color-text-secondary);
	}

	.detail-reset-btn {
		background: rgba(196, 68, 58, 0.18);
		border-color: rgba(196, 68, 58, 0.38);
		color: #ffb4ad;
	}

	.detail-remove-btn {
		background: rgba(196, 68, 58, 0.18);
		border-color: rgba(196, 68, 58, 0.38);
		color: #ffb4ad;
	}

	.detail-download-btn:disabled,
	.detail-refetch-btn:disabled,
	.detail-reset-btn:disabled,
	.detail-remove-btn:disabled,
	.rating-star:disabled,
	.rating-clear:disabled,
	.device-remove-btn:disabled,
	.modal-btn:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.modal-content {
		width: min(430px, 100%);
		border-radius: 0.86rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 1rem;
		text-align: center;
	}

	.modal-icon {
		width: 52px;
		height: 52px;
		display: inline-grid;
		place-items: center;
		border-radius: 50%;
		background: rgba(201, 169, 98, 0.18);
		color: var(--color-primary);
		margin-bottom: 0.6rem;
	}

	.modal-content h3 {
		margin: 0 0 0.3rem;
		font-size: 1rem;
	}

	.modal-description {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.modal-description strong {
		color: var(--color-text-primary);
	}

	.modal-actions {
		display: flex;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 0.75rem;
	}

	.modal-btn.cancel {
		background: #232834;
		color: var(--color-text-secondary);
	}

	.modal-btn.confirm {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	@media (max-width: 700px) {
		.detail-modal-content {
			padding: 0.72rem;
			max-height: calc(100dvh - 1rem);
		}

		.metadata-grid,
		.metadata-edit-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.detail-download-btn,
		.detail-refetch-btn,
		.detail-reset-btn,
		.detail-remove-btn,
		.modal-btn {
			width: 100%;
		}

		.detail-actions,
		.modal-actions {
			justify-content: stretch;
		}
	}
</style>
