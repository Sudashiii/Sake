import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { DeviceDownloadRepositoryPort } from '$lib/server/application/ports/DeviceDownloadRepositoryPort';
import type { DeviceProgressDownloadRepositoryPort } from '$lib/server/application/ports/DeviceProgressDownloadRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { PutLibraryFileUseCase } from '$lib/server/application/use-cases/PutLibraryFileUseCase';
import type { Book } from '$lib/server/domain/entities/Book';
import { isIncomingProgressOlder } from '$lib/server/domain/services/ProgressConflictPolicy';
import {
	buildProgressFileDescriptor,
	extractPercentFinished,
	extractSummaryModifiedTimestamp
} from '$lib/server/domain/value-objects/ProgressFile';
import { sanitizeLibraryStorageKey } from '$lib/server/domain/value-objects/StorageKeySanitizer';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

type BookOutcome = 'created' | 'duplicate';
type SidecarOutcome = 'imported' | 'missing' | 'skipped_older';

interface ExportDeviceLibraryBookInput {
	deviceId: string;
	fileName: string;
	fileData: ArrayBuffer;
	sidecarData?: ArrayBuffer;
}

interface ExportDeviceLibraryBookResult {
	success: true;
	bookOutcome: BookOutcome;
	sidecarOutcome: SidecarOutcome;
}

type LibraryFileImporter = Pick<PutLibraryFileUseCase, 'execute'>;

const SUPPORTED_EXPORT_EXTENSIONS = new Set(['epub', 'pdf', 'mobi']);

type StorageErrorLike = {
	name?: unknown;
	code?: unknown;
	statusCode?: unknown;
	$metadata?: {
		httpStatusCode?: unknown;
	};
	message?: unknown;
};

function extensionFromFileName(fileName: string): string | null {
	const match = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
	return match?.[1] ?? null;
}

function trashedDuplicateMessage(title: string): string {
	return `A trashed book with this file name already exists. Rename the new file or permanently delete "${title}" from trash first.`;
}

function asStorageErrorLike(cause: unknown): StorageErrorLike | null {
	if (!cause || typeof cause !== 'object') {
		return null;
	}

	return cause as StorageErrorLike;
}

function isMissingStorageObjectError(cause: unknown): boolean {
	const errorLike = asStorageErrorLike(cause);
	if (!errorLike) {
		return false;
	}

	if (
		errorLike.name === 'NotFound' ||
		errorLike.name === 'NoSuchKey' ||
		errorLike.code === 'NotFound' ||
		errorLike.code === 'NoSuchKey' ||
		errorLike.statusCode === 404 ||
		errorLike.$metadata?.httpStatusCode === 404
	) {
		return true;
	}

	return typeof errorLike.message === 'string' && /\bnot found\b/i.test(errorLike.message);
}

export class ExportDeviceLibraryBookUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly deviceDownloadRepository: DeviceDownloadRepositoryPort,
		private readonly deviceProgressDownloadRepository: DeviceProgressDownloadRepositoryPort,
		private readonly storage: StoragePort,
		private readonly libraryFileImporter: LibraryFileImporter
	) {}

	async execute(
		input: ExportDeviceLibraryBookInput
	): Promise<ApiResult<ExportDeviceLibraryBookResult>> {
		const extension = extensionFromFileName(input.fileName);
		if (!extension || !SUPPORTED_EXPORT_EXTENSIONS.has(extension)) {
			return apiError('Unsupported file extension. Only EPUB, PDF, and MOBI are allowed.', 400);
		}
		if (input.fileData.byteLength === 0) {
			return apiError('Uploaded file is empty', 400);
		}

		const storageKey = sanitizeLibraryStorageKey(input.fileName);
		const existingMatch = await this.bookRepository.getByStorageKeyIncludingTrashed(storageKey);

		let book: Book;
		let bookOutcome: BookOutcome;

		if (existingMatch?.deleted_at) {
			return apiError(trashedDuplicateMessage(existingMatch.title), 409);
		}

		if (existingMatch) {
			book = existingMatch;
			bookOutcome = 'duplicate';
		} else {
			const importResult = await this.libraryFileImporter.execute(input.fileName, input.fileData);
			if (!importResult.ok) {
				return importResult;
			}

			const createdBook = await this.bookRepository.getByStorageKey(storageKey);
			if (!createdBook) {
				return apiError('Exported book could not be resolved after import', 500);
			}

			book = createdBook;
			bookOutcome = 'created';
		}

		await this.deviceDownloadRepository.ensureByDeviceAndBook({
			deviceId: input.deviceId,
			bookId: book.id
		});

		const sidecarResult = await this.importSidecar(book, input);
		if (!sidecarResult.ok) {
			return sidecarResult;
		}

		return apiOk({
			success: true,
			bookOutcome,
			sidecarOutcome: sidecarResult.value
		});
	}

	private async importSidecar(
		book: Book,
		input: ExportDeviceLibraryBookInput
	): Promise<ApiResult<SidecarOutcome>> {
		if (!input.sidecarData) {
			return apiOk('missing');
		}
		if (input.sidecarData.byteLength === 0) {
			return apiError('Uploaded sidecar file is empty', 400);
		}

		let descriptor;
		try {
			descriptor = buildProgressFileDescriptor(book.s3_storage_key);
		} catch (cause) {
			return apiError('Invalid title format. Expected filename with extension.', 400, cause);
		}

		const sidecarBuffer = Buffer.from(input.sidecarData);
		const incomingContent = sidecarBuffer.toString('utf8');
		const incomingModified = extractSummaryModifiedTimestamp(incomingContent);

		const existingSidecarResult = await this.readExistingSidecarContent(
			`library/${descriptor.progressKey}`
		);
		if (!existingSidecarResult.ok) {
			return existingSidecarResult;
		}

		if (existingSidecarResult.value) {
			const existingModified = extractSummaryModifiedTimestamp(existingSidecarResult.value);
			if (isIncomingProgressOlder(existingModified, incomingModified)) {
				return apiOk('skipped_older');
			}
		}

		const progressPercent = extractPercentFinished(incomingContent) ?? book.progress_percent ?? null;
		const progressUpdatedAt = incomingModified ?? new Date().toISOString();

		await this.storage.put(`library/${descriptor.progressKey}`, sidecarBuffer, 'application/x-lua');
		await this.bookRepository.updateProgress(
			book.id,
			descriptor.progressKey,
			progressPercent,
			progressUpdatedAt
		);
		await this.deviceProgressDownloadRepository.upsertByDeviceAndBook({
			deviceId: input.deviceId,
			bookId: book.id,
			progressUpdatedAt
		});

		return apiOk('imported');
	}

	private async readExistingSidecarContent(progressStorageKey: string): Promise<ApiResult<string | null>> {
		try {
			if (typeof this.storage.exists === 'function') {
				const exists = await this.storage.exists(progressStorageKey);
				if (!exists) {
					return apiOk(null);
				}
			}

			return apiOk((await this.storage.get(progressStorageKey)).toString('utf8'));
		} catch (cause) {
			if (isMissingStorageObjectError(cause)) {
				return apiOk(null);
			}

			return apiError('Failed to read existing progress sidecar', 500, cause);
		}
	}
}
