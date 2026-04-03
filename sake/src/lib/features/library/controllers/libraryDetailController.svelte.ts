import { toastStore } from '$lib/client/stores/toastStore.svelte';
import { ZUI } from '$lib/client/zui';
import { loadLibraryBookDetail } from '$lib/features/library/libraryDetailLoader';
import {
	parseDateTimeLocalInputValue,
	parseNullableNumber,
	toDraftText,
	toDateTimeLocalInputValue,
	type DetailTab,
	type LibraryView,
	type MetadataDraft
} from '$lib/features/library/libraryView';
import type { LibraryBook } from '$lib/types/Library/Book';
import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
import type { BookProgressHistoryEntry } from '$lib/types/Library/BookProgressHistory';
import type { LibraryMetadataUpdate } from './libraryListController.svelte';

interface LibraryDetailControllerOptions {
	getCurrentView: () => LibraryView;
	setCurrentView: (view: LibraryView) => void;
	loadShelves: () => Promise<void>;
	loadLibrary: () => Promise<void>;
	loadTrash: () => Promise<void>;
	updateLibraryUrl: (openBookId?: number | null) => void;
	openResetModal: (book: LibraryBook) => void;
	applyBookMetadataUpdate: (updated: LibraryMetadataUpdate) => LibraryBook | null;
	setBookDownloadedState: (bookId: number, isDownloaded: boolean) => LibraryBook | null;
	setBookRatingState: (bookId: number, rating: number | null) => LibraryBook | null;
	setBookCoverState: (bookId: number, cover: string | null) => LibraryBook | null;
	setBookArchiveState: (
		bookId: number,
		archivedAt: string | null,
		excludeFromNewBooks: boolean
	) => LibraryBook | null;
	setBookShelfIdsState: (bookId: number, shelfIds: number[]) => LibraryBook | null;
	getIsUpdatingShelves: () => boolean;
	setIsUpdatingShelves: (value: boolean) => void;
}

export class LibraryDetailController {
	showDetailModal = $state(false);
	selectedBook = $state<LibraryBook | null>(null);
	selectedBookDetail = $state<LibraryBookDetail | null>(null);
	detailModalView = $state<LibraryView | null>(null);
	activeDetailTab = $state<DetailTab>('overview');
	isDetailLoading = $state(false);
	isRefetchingMetadata = $state(false);
	isProgressHistoryLoading = $state(false);
	showProgressHistory = $state(false);
	removingDeviceId = $state<string | null>(null);
	isMovingToTrash = $state(false);
	isDownloadingLibraryFile = $state(false);
	isUpdatingRating = $state(false);
	isUpdatingReadState = $state(false);
	isUpdatingArchiveState = $state(false);
	isUpdatingNewBooksExclusion = $state(false);
	isEditingMetadata = $state(false);
	isSavingMetadata = $state(false);
	isImportingCover = $state(false);
	detailError = $state<string | null>(null);
	progressHistoryError = $state<string | null>(null);
	progressHistory = $state<BookProgressHistoryEntry[]>([]);
	metadataDraft = $state<MetadataDraft>({
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
		externalRatingCount: '',
		createdAt: ''
	});

	constructor(private readonly options: LibraryDetailControllerOptions) {}

	async openDetailModal(book: LibraryBook): Promise<void> {
		await this.options.loadShelves();
		this.detailModalView = this.options.getCurrentView();
		this.options.updateLibraryUrl(book.id);
		this.selectedBook = book;
		this.selectedBookDetail = null;
		this.activeDetailTab = 'overview';
		this.detailError = null;
		this.progressHistoryError = null;
		this.progressHistory = [];
		this.showProgressHistory = false;
		this.isEditingMetadata = false;
		this.showDetailModal = true;
		this.isDetailLoading = true;

		const result = await loadLibraryBookDetail(book.id);
		if (result.ok) {
			this.selectedBookDetail = result.value;
			this.initializeMetadataDraft(result.value);
			await this.loadProgressHistory(book.id);
		} else {
			this.detailError = result.error.message;
		}

		this.isDetailLoading = false;
	}

	closeDetailModal(): void {
		if (this.isMovingToTrash) {
			return;
		}

		const nextView = this.detailModalView ?? this.options.getCurrentView();
		this.options.setCurrentView(nextView);
		this.options.updateLibraryUrl(null);
		this.showDetailModal = false;
		this.selectedBook = null;
		this.selectedBookDetail = null;
		this.detailModalView = null;
		this.detailError = null;
		this.isDetailLoading = false;
		this.isProgressHistoryLoading = false;
		this.isRefetchingMetadata = false;
		this.removingDeviceId = null;
		this.isMovingToTrash = false;
		this.isDownloadingLibraryFile = false;
		this.isUpdatingRating = false;
		this.isUpdatingReadState = false;
		this.isUpdatingArchiveState = false;
		this.isUpdatingNewBooksExclusion = false;
		this.options.setIsUpdatingShelves(false);
		this.isEditingMetadata = false;
		this.isSavingMetadata = false;
		this.isImportingCover = false;
		this.progressHistoryError = null;
		this.progressHistory = [];
		this.showProgressHistory = false;
		this.activeDetailTab = 'overview';
	}

	async handleRefetchMetadata(): Promise<void> {
		if (!this.selectedBook || this.isRefetchingMetadata) {
			return;
		}

		this.isRefetchingMetadata = true;
		const result = await ZUI.refetchLibraryBookMetadata(this.selectedBook.id);
		this.isRefetchingMetadata = false;

		if (!result.ok) {
			this.detailError = result.error.message;
			toastStore.add(`Failed to refetch metadata: ${result.error.message}`, 'error');
			return;
		}

		const updatedBook = this.options.applyBookMetadataUpdate({
			...result.value.book,
			createdAt: this.selectedBook?.createdAt ?? null
		});
		if (updatedBook) {
			this.selectedBook = updatedBook;
		}
		if (this.selectedBookDetail) {
			this.selectedBookDetail = {
				...this.selectedBookDetail,
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
			this.initializeMetadataDraft(this.selectedBookDetail);
		}
		this.detailError = null;
		toastStore.add('Book metadata refreshed', 'success');
	}

	startMetadataEdit(): void {
		if (!this.selectedBookDetail) {
			return;
		}
		this.initializeMetadataDraft(this.selectedBookDetail);
		this.isEditingMetadata = true;
	}

	cancelMetadataEdit(): void {
		this.isEditingMetadata = false;
		if (this.selectedBookDetail) {
			this.initializeMetadataDraft(this.selectedBookDetail);
		}
	}

	async saveMetadataEdit(): Promise<void> {
		if (!this.selectedBook || !this.selectedBookDetail || this.isSavingMetadata) {
			return;
		}
		const selectedBookId = this.selectedBook.id;

		const title = this.metadataDraft.title.trim();
		if (!title) {
			toastStore.add('Title cannot be empty', 'error');
			return;
		}

		const year = parseNullableNumber(this.metadataDraft.year);
		const month = parseNullableNumber(this.metadataDraft.month);
		const day = parseNullableNumber(this.metadataDraft.day);
		if (year === null && (month !== null || day !== null)) {
			toastStore.add('Published date month and day require a year', 'error');
			return;
		}
		if (month === null && day !== null) {
			toastStore.add('Published date day requires a month', 'error');
			return;
		}

		this.isSavingMetadata = true;
		const createdAt = parseDateTimeLocalInputValue(this.metadataDraft.createdAt);
		if (this.metadataDraft.createdAt.trim() && createdAt === null) {
			this.isSavingMetadata = false;
			toastStore.add('Date added must be a valid date and time', 'error');
			return;
		}
		const updateResult = await ZUI.updateLibraryBookMetadata(selectedBookId, {
			title,
			author: this.metadataDraft.author.trim() || null,
			publisher: this.metadataDraft.publisher.trim() || null,
			series: this.metadataDraft.series.trim() || null,
			seriesIndex: parseNullableNumber(this.metadataDraft.seriesIndex),
			volume: this.metadataDraft.volume.trim() || null,
			edition: this.metadataDraft.edition.trim() || null,
			identifier: this.metadataDraft.identifier.trim() || null,
			pages: parseNullableNumber(this.metadataDraft.pages),
			description: this.metadataDraft.description.trim() || null,
			cover: this.metadataDraft.cover.trim() || null,
			language: this.metadataDraft.language.trim() || null,
			year,
			month: year === null ? null : month,
			day: year === null || month === null ? null : day,
			googleBooksId: this.metadataDraft.googleBooksId.trim() || null,
			openLibraryKey: this.metadataDraft.openLibraryKey.trim() || null,
			amazonAsin: this.metadataDraft.amazonAsin.trim() || null,
			externalRating: parseNullableNumber(this.metadataDraft.externalRating),
			externalRatingCount: parseNullableNumber(this.metadataDraft.externalRatingCount),
			createdAt
		});
		this.isSavingMetadata = false;

		if (!updateResult.ok) {
			toastStore.add(`Failed to save metadata: ${updateResult.error.message}`, 'error');
			return;
		}

		const detailResult = await loadLibraryBookDetail(selectedBookId);
		if (detailResult.ok) {
			this.selectedBookDetail = detailResult.value;
			this.initializeMetadataDraft(detailResult.value);

			const updatedBook = this.options.applyBookMetadataUpdate({
				id: selectedBookId,
				zLibId: this.selectedBook.zLibId,
				title: detailResult.value.title,
				author: detailResult.value.author,
				publisher: detailResult.value.publisher,
				series: detailResult.value.series,
				seriesIndex: detailResult.value.seriesIndex,
				volume: detailResult.value.volume,
				edition: detailResult.value.edition,
				identifier: detailResult.value.identifier,
				pages: detailResult.value.pages,
				description: detailResult.value.description,
				googleBooksId: detailResult.value.googleBooksId,
				openLibraryKey: detailResult.value.openLibraryKey,
				amazonAsin: detailResult.value.amazonAsin,
				externalRating: detailResult.value.externalRating,
				externalRatingCount: detailResult.value.externalRatingCount,
				cover: this.metadataDraft.cover.trim() || null,
				extension: this.selectedBook.extension,
				filesize: this.selectedBook.filesize,
				language: this.metadataDraft.language.trim() || null,
				year: detailResult.value.year,
				month: detailResult.value.month,
				day: detailResult.value.day,
				createdAt
			});
			if (updatedBook) {
				this.selectedBook = updatedBook;
			}
		}

		await this.options.loadLibrary();
		this.isEditingMetadata = false;
		toastStore.add('Metadata updated', 'success');
	}

	async handleImportCover(): Promise<void> {
		if (!this.selectedBook || this.isImportingCover) {
			return;
		}

		const coverUrl = this.metadataDraft.cover.trim() || this.selectedBook.cover;
		if (!coverUrl) {
			toastStore.add('No cover URL available to import', 'error');
			return;
		}

		this.isImportingCover = true;
		const result = await ZUI.importLibraryBookCover(this.selectedBook.id, coverUrl);
		this.isImportingCover = false;

		if (!result.ok) {
			toastStore.add(`Failed to import cover: ${result.error.message}`, 'error');
			return;
		}

		const updatedBook = this.options.setBookCoverState(this.selectedBook.id, result.value.cover);
		if (updatedBook) {
			this.selectedBook = updatedBook;
		}
		this.metadataDraft.cover = result.value.cover;
		toastStore.add('Cover stored internally', 'success');
	}

	async handleSetRating(rating: number | null): Promise<void> {
		if (!this.selectedBook || this.isUpdatingRating) {
			return;
		}
		this.isUpdatingRating = true;
		const result = await ZUI.updateLibraryBookRating(this.selectedBook.id, rating);
		this.isUpdatingRating = false;
		if (!result.ok) {
			toastStore.add(`Failed to update rating: ${result.error.message}`, 'error');
			return;
		}
		const updatedBook = this.options.setBookRatingState(this.selectedBook.id, result.value.rating);
		if (updatedBook) {
			this.selectedBook = updatedBook;
		}

		if (this.selectedBookDetail) {
			this.selectedBookDetail = {
				...this.selectedBookDetail,
				rating
			};
		}

		toastStore.add(
			result.value.rating === null
				? 'Rating cleared'
				: `Rating updated to ${result.value.rating} star${result.value.rating === 1 ? '' : 's'}`,
			'success'
		);
	}

	async handleToggleReadState(): Promise<void> {
		if (!this.selectedBook || !this.selectedBookDetail || this.isUpdatingReadState) {
			return;
		}
		const nextIsRead = !this.selectedBookDetail.isRead;
		this.isUpdatingReadState = true;
		const result = await ZUI.updateLibraryBookState(this.selectedBook.id, { isRead: nextIsRead });
		this.isUpdatingReadState = false;
		if (!result.ok) {
			toastStore.add(`Failed to update read state: ${result.error.message}`, 'error');
			return;
		}
		this.selectedBookDetail = {
			...this.selectedBookDetail,
			isRead: result.value.isRead,
			readAt: result.value.readAt,
			progressPercent:
				typeof result.value.progressPercent === 'number'
					? Math.max(0, Math.min(100, result.value.progressPercent * 100))
					: null
		};
		toastStore.add(result.value.isRead ? 'Marked as read' : 'Marked as unread', 'success');
	}

	async handleToggleExcludeFromNewBooks(): Promise<void> {
		if (!this.selectedBook || !this.selectedBookDetail || this.isUpdatingNewBooksExclusion) {
			return;
		}
		const nextValue = !this.selectedBookDetail.excludeFromNewBooks;
		this.isUpdatingNewBooksExclusion = true;
		const result = await ZUI.updateLibraryBookState(this.selectedBook.id, {
			excludeFromNewBooks: nextValue
		});
		this.isUpdatingNewBooksExclusion = false;
		if (!result.ok) {
			toastStore.add(`Failed to update new-books exclusion: ${result.error.message}`, 'error');
			return;
		}
		this.selectedBookDetail = {
			...this.selectedBookDetail,
			excludeFromNewBooks: result.value.excludeFromNewBooks
		};
		toastStore.add(
			result.value.excludeFromNewBooks
				? 'Book excluded from new-books API'
				: 'Book included in new-books API',
			'success'
		);
	}

	async handleToggleArchiveState(): Promise<void> {
		if (!this.selectedBook || !this.selectedBookDetail || this.isUpdatingArchiveState) {
			return;
		}
		const targetBook = this.selectedBook;
		const nextArchived = !this.selectedBookDetail.isArchived;
		this.isUpdatingArchiveState = true;
		const result = await ZUI.updateLibraryBookState(targetBook.id, { archived: nextArchived });
		this.isUpdatingArchiveState = false;
		if (!result.ok) {
			toastStore.add(`Failed to update archive state: ${result.error.message}`, 'error');
			return;
		}
		this.selectedBookDetail = {
			...this.selectedBookDetail,
			isArchived: result.value.isArchived,
			archivedAt: result.value.archivedAt,
			excludeFromNewBooks: result.value.excludeFromNewBooks
		};
		const updatedBook = this.options.setBookArchiveState(
			targetBook.id,
			result.value.archivedAt,
			result.value.excludeFromNewBooks
		);
		if (updatedBook) {
			this.selectedBook = updatedBook;
		}
		toastStore.add(
			result.value.isArchived
				? 'Book archived (it will no longer appear in New Books API)'
				: 'Book unarchived',
			'success'
		);
	}

	async handleRemoveDeviceDownload(deviceId: string): Promise<void> {
		if (!this.selectedBook || !this.selectedBookDetail || this.removingDeviceId) {
			return;
		}
		this.removingDeviceId = deviceId;
		const result = await ZUI.removeLibraryBookDeviceDownload(this.selectedBook.id, deviceId);
		this.removingDeviceId = null;
		if (!result.ok) {
			toastStore.add(`Failed to remove device download: ${result.error.message}`, 'error');
			return;
		}
		const remaining = this.selectedBookDetail.downloadedDevices.filter((item) => item !== deviceId);
		this.selectedBookDetail = {
			...this.selectedBookDetail,
			downloadedDevices: remaining
		};
		const updatedBook = this.options.setBookDownloadedState(
			this.selectedBook.id,
			remaining.length > 0
		);
		if (updatedBook) {
			this.selectedBook = updatedBook;
		}
		toastStore.add(`Removed download for device "${deviceId}"`, 'success');
	}

	async handleMoveToTrash(): Promise<void> {
		if (!this.selectedBook || this.isMovingToTrash) {
			return;
		}
		const targetBook = this.selectedBook;
		this.isMovingToTrash = true;
		const result = await ZUI.moveLibraryBookToTrash(targetBook.id);
		this.isMovingToTrash = false;
		if (!result.ok) {
			toastStore.add(`Failed to move book to trash: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Moved "${targetBook.title}" to trash`, 'success');
		this.closeDetailModal();
		await this.options.loadLibrary();
		await this.options.loadTrash();
	}

	async handleDownloadFromLibrary(): Promise<void> {
		if (!this.selectedBook || this.isDownloadingLibraryFile) {
			return;
		}
		const targetBook = this.selectedBook;
		this.isDownloadingLibraryFile = true;
		const result = await ZUI.downloadLibraryBookFile(
			targetBook.s3_storage_key,
			this.buildLibraryDownloadName(targetBook)
		);
		this.isDownloadingLibraryFile = false;
		if (!result.ok) {
			toastStore.add(`Failed to download from library: ${result.error.message}`, 'error');
			return;
		}
		toastStore.add(`Downloaded "${targetBook.title}"`, 'success');
	}

	async handleToggleShelfAssignment(shelfId: number): Promise<void> {
		if (
			!this.selectedBook ||
			!this.selectedBookDetail ||
			this.options.getIsUpdatingShelves()
		) {
			return;
		}
		const currentIds = [...new Set(this.selectedBookDetail.shelfIds)];
		const nextIds = currentIds.includes(shelfId)
			? currentIds.filter((id) => id !== shelfId)
			: [...currentIds, shelfId];
		this.options.setIsUpdatingShelves(true);
		const result = await ZUI.setLibraryBookShelves(this.selectedBook.id, nextIds);
		this.options.setIsUpdatingShelves(false);
		if (!result.ok) {
			toastStore.add(`Failed to update shelves: ${result.error.message}`, 'error');
			return;
		}
		const updatedBook = this.options.setBookShelfIdsState(this.selectedBook.id, result.value.shelfIds);
		if (updatedBook) {
			this.selectedBook = updatedBook;
		}
		if (this.selectedBookDetail) {
			this.selectedBookDetail = {
				...this.selectedBookDetail,
				shelfIds: [...new Set(result.value.shelfIds)].sort((a, b) => a - b)
			};
		}
	}

	openResetFromDetail(): void {
		if (!this.selectedBook) {
			return;
		}
		const targetBook = this.selectedBook;
		this.closeDetailModal();
		this.options.openResetModal(targetBook);
	}

	private async loadProgressHistory(bookId: number): Promise<void> {
		this.isProgressHistoryLoading = true;
		this.progressHistoryError = null;
		const result = await ZUI.getLibraryBookProgressHistory(bookId);
		this.isProgressHistoryLoading = false;
		if (!result.ok) {
			this.progressHistoryError = result.error.message;
			this.progressHistory = [];
			return;
		}
		this.progressHistory = result.value.history;
	}

	private initializeMetadataDraft(detail: LibraryBookDetail): void {
		this.metadataDraft = {
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
			cover: toDraftText(this.selectedBook?.cover ?? ''),
			language: toDraftText(this.selectedBook?.language ?? ''),
			year: toDraftText(detail.year),
			month: toDraftText(detail.month),
			day: toDraftText(detail.day),
			googleBooksId: toDraftText(detail.googleBooksId),
			openLibraryKey: toDraftText(detail.openLibraryKey),
			amazonAsin: toDraftText(detail.amazonAsin),
			externalRating: toDraftText(detail.externalRating),
			externalRatingCount: toDraftText(detail.externalRatingCount),
			createdAt: toDateTimeLocalInputValue(this.selectedBook?.createdAt ?? null)
		};
	}

	private buildLibraryDownloadName(book: LibraryBook): string {
		const rawTitle = (book.title || 'book').trim();
		const title = rawTitle.length > 0 ? rawTitle : 'book';
		const extension = book.extension?.trim().toLowerCase();
		if (!extension) {
			return title;
		}
		return title.toLowerCase().endsWith(`.${extension}`) ? title : `${title}.${extension}`;
	}
}
