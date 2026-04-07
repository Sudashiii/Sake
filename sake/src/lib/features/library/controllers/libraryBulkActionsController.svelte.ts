import type { LibraryListController } from './libraryListController.svelte';

export class LibraryBulkActionsController {
	constructor(private readonly listController: LibraryListController) {}

	get selectedCount(): number {
		return this.listController.selectedBookIds.length;
	}

	get visibleCount(): number {
		return this.listController.filteredLibraryBooks.length;
	}

	get shelves() {
		return this.listController.shelves;
	}

	get isPending(): boolean {
		return this.listController.isBulkActionPending;
	}

	disableSelectionMode = (): void => {
		this.listController.disableSelectionMode();
	};

	selectAllVisible = (): void => {
		this.listController.selectAllVisibleBooks();
	};

	clearSelection = (): void => {
		this.listController.clearSelectedBooks();
	};

	archiveSelected = async (): Promise<void> => {
		await this.listController.handleBulkArchiveSelected();
	};

	markReadSelected = async (): Promise<void> => {
		await this.listController.handleBulkMarkReadSelected();
	};

	markUnreadSelected = async (): Promise<void> => {
		await this.listController.handleBulkMarkUnreadSelected();
	};

	requestMoveToTrash = (): void => {
		this.listController.requestBulkMoveToTrash();
	};

	resetDownloadsSelected = async (): Promise<void> => {
		await this.listController.handleBulkResetDownloadsSelected();
	};

	addSelectionToShelf = async (shelfId: number): Promise<void> => {
		await this.listController.handleBulkShelfSelection(shelfId, 'add');
	};

	removeSelectionFromShelf = async (shelfId: number): Promise<void> => {
		await this.listController.handleBulkShelfSelection(shelfId, 'remove');
	};
}
