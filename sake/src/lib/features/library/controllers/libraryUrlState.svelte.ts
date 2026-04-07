import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { fromStore } from 'svelte/store';
import { findBookByOpenBookId } from '$lib/features/library/libraryDetailLoader';
import {
	parseViewFromUrl,
	type LibraryView
} from '$lib/features/library/libraryView';
import { parseOpenBookIdFromSearch } from '$lib/features/library/libraryRouteUrlState';
import type { LibraryBook } from '$lib/types/Library/Book';
import { LibraryDetailController } from './libraryDetailController.svelte';
import { LibraryListController } from './libraryListController.svelte';
import { LibraryUploadController } from './libraryUploadController.svelte';

interface LibraryPageControllers {
	listController: LibraryListController;
	detailController: LibraryDetailController;
	uploadController: LibraryUploadController;
	urlState: LibraryUrlState;
}

export function createLibraryPageControllers(): LibraryPageControllers {
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
	const urlState = new LibraryUrlState({
		listController,
		detailController
	});

	return {
		listController,
		detailController,
		uploadController,
		urlState
	};
}

class LibraryUrlState {
	private readonly pageState = fromStore(page);

	selectedShelfId = $derived.by(() => {
		const currentPage = this.pageState.current;
		if (currentPage.url.pathname !== '/library') {
			return null;
		}

		const raw = currentPage.url.searchParams.get('shelf');
		if (!raw) {
			return null;
		}

		const parsed = Number.parseInt(raw, 10);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	});

	constructor(
		private readonly options: {
			listController: LibraryListController;
			detailController: LibraryDetailController;
		}
	) {
		$effect(() => {
			this.options.listController.selectedShelfId = this.selectedShelfId;
			this.options.listController.isDetailModalOpen = this.options.detailController.showDetailModal;
		});
	}

	async initialize(): Promise<void> {
		this.options.listController.initializeSortPreference();

		const params = new URLSearchParams(window.location.search);
		const requestedView = parseViewFromUrl(params.get('view'));
		const openBookId = parseOpenBookIdFromSearch(window.location.search);
		if (await this.redirectForExternalView(requestedView, openBookId)) {
			return;
		}

		if (requestedView === 'library') {
			this.options.listController.currentView = 'library';
		}

		if (this.options.listController.currentView === 'trash') {
			await this.options.listController.loadTrash();
			return;
		}

		await this.options.listController.loadLibrary();
		await this.options.listController.loadShelves();

		if (openBookId !== null) {
			const candidate = this.findOpenBookCandidate(openBookId);
			if (candidate) {
				await this.options.detailController.openDetailModal(candidate);
			}
		}
	}

	private async redirectForExternalView(
		requestedView: LibraryView | null,
		openBookId: number | null
	): Promise<boolean> {
		if (requestedView === 'archived') {
			const archivedTarget =
				openBookId === null ? '/archived' : `/archived?openBookId=${openBookId}`;
			await goto(archivedTarget, { replaceState: true });
			return true;
		}

		if (requestedView === 'trash') {
			await goto('/trash', { replaceState: true });
			return true;
		}

		return false;
	}

	private findOpenBookCandidate(openBookId: number): LibraryBook | undefined {
		const candidate = findBookByOpenBookId(this.options.listController.books, openBookId);
		if (!candidate) {
			return undefined;
		}

		return this.options.listController.currentView !== 'archived' || Boolean(candidate.archived_at)
			? candidate
			: undefined;
	}
}
