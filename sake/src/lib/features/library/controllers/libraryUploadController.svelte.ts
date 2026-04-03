import { toastStore } from '$lib/client/stores/toastStore.svelte';
import { ZUI } from '$lib/client/zui';
import type { LibraryView } from '$lib/features/library/libraryView';

interface LibraryUploadControllerOptions {
	getCurrentView: () => LibraryView;
	onLibraryChanged: () => Promise<void>;
}

export class LibraryUploadController {
	isUploadingLibraryFile = $state(false);
	isLibraryDropActive = $state(false);

	private libraryDropDepth = 0;

	constructor(private readonly options: LibraryUploadControllerOptions) {}

	handleLibraryUploadChange = async (event: Event): Promise<void> => {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		await this.uploadLibraryFiles(files);
	};

	handleLibraryDragEnter = (event: DragEvent): void => {
		if (
			this.options.getCurrentView() !== 'library' ||
			this.isUploadingLibraryFile ||
			!this.isFileDragEvent(event)
		) {
			return;
		}
		event.preventDefault();
		this.libraryDropDepth += 1;
		this.isLibraryDropActive = true;
	};

	handleLibraryDragOver = (event: DragEvent): void => {
		if (this.options.getCurrentView() !== 'library' || !this.isFileDragEvent(event)) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = this.isUploadingLibraryFile ? 'none' : 'copy';
		}
	};

	handleLibraryDragLeave = (event: DragEvent): void => {
		if (this.options.getCurrentView() !== 'library' || !this.isFileDragEvent(event)) {
			return;
		}
		event.preventDefault();
		this.libraryDropDepth = Math.max(0, this.libraryDropDepth - 1);
		if (this.libraryDropDepth === 0) {
			this.isLibraryDropActive = false;
		}
	};

	handleLibraryDrop = async (event: DragEvent): Promise<void> => {
		if (this.options.getCurrentView() !== 'library' || !this.isFileDragEvent(event)) {
			return;
		}
		event.preventDefault();
		const files = Array.from(event.dataTransfer?.files ?? []);
		this.resetLibraryDropState();
		await this.uploadLibraryFiles(files);
	};

	resetLibraryDropState(): void {
		this.libraryDropDepth = 0;
		this.isLibraryDropActive = false;
	}

	private isFileDragEvent(event: DragEvent): boolean {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

	private formatUploadFailureSummary(
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

	private async uploadLibraryFiles(files: File[]): Promise<void> {
		if (files.length === 0 || this.isUploadingLibraryFile) {
			return;
		}

		this.resetLibraryDropState();
		this.isUploadingLibraryFile = true;
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

		this.isUploadingLibraryFile = false;

		if (uploadedFiles.length > 0) {
			if (uploadedFiles.length === 1 && failedFiles.length === 0) {
				toastStore.add(`Uploaded "${uploadedFiles[0]}"`, 'success');
			} else if (failedFiles.length === 0) {
				toastStore.add(`Uploaded ${uploadedFiles.length} books`, 'success');
			} else {
				toastStore.add(`Uploaded ${uploadedFiles.length} of ${files.length} books`, 'success');
			}
			await this.options.onLibraryChanged();
		}

		if (failedFiles.length > 0) {
			toastStore.add(this.formatUploadFailureSummary(failedFiles), 'error', 5000);
		}
	}
}
