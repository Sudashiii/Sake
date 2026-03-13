import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import { sanitizeLibraryStorageKey } from '$lib/server/domain/value-objects/StorageKeySanitizer';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { ExternalBookMetadata } from '$lib/server/application/services/ExternalBookMetadataService';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';

interface PutLibraryFileResult {
	success: true;
}

function stripExtension(fileName: string): string {
	const idx = fileName.lastIndexOf('.');
	if (idx <= 0) {
		return fileName;
	}

	return fileName.slice(0, idx);
}

function extensionFromFileName(fileName: string): string | null {
	const idx = fileName.lastIndexOf('.');
	if (idx <= 0 || idx === fileName.length - 1) {
		return null;
	}

	return fileName.slice(idx + 1).toLowerCase();
}

export class PutLibraryFileUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'PutLibraryFileUseCase' });

	constructor(
		private readonly storage: StoragePort,
		private readonly bookRepository: BookRepositoryPort,
		private readonly externalMetadataService = new ExternalBookMetadataService()
	) {}

	async execute(title: string, body: ArrayBuffer): Promise<ApiResult<PutLibraryFileResult>> {
		if (body.byteLength === 0) {
			return apiError('Uploaded file is empty', 400);
		}

		const sanitizedKey = sanitizeLibraryStorageKey(title);
		const existingBook = await this.bookRepository.getByStorageKey(sanitizedKey);
		if (existingBook) {
			this.useCaseLogger.warn(
				{
					event: 'library.file.upload.duplicate',
					originalStorageKey: title,
					storageKey: sanitizedKey,
					existingBookId: existingBook.id
				},
				'Manual upload rejected because storage key already exists'
			);
			return apiError(`Book already exists in library (storage key: ${sanitizedKey})`, 409);
		}

		const key = `library/${sanitizedKey}`;
		await this.storage.put(key, Buffer.from(body), 'application/octet-stream');
		this.useCaseLogger.info(
			{ event: 'library.file.uploaded', originalStorageKey: title, storageKey: sanitizedKey },
			'Library file uploaded'
		);
		const extension = extensionFromFileName(sanitizedKey);
		const displayTitle = stripExtension(title).trim() || stripExtension(sanitizedKey);

		let metadata: ExternalBookMetadata | null = null;
		try {
			metadata = await this.externalMetadataService.lookup({
				title: displayTitle,
				author: null,
				identifier: null,
				language: null
			});
		} catch (err: unknown) {
			this.useCaseLogger.warn(
				{
					event: 'library.metadata.lookup.failed',
					originalStorageKey: title,
					storageKey: sanitizedKey,
					lookupTitle: displayTitle,
					error: toLogError(err)
				},
				'Metadata lookup failed during manual upload, continuing with empty metadata'
			);
		}

		await this.bookRepository.create({
			s3_storage_key: sanitizedKey,
			title: displayTitle,
			zLibId: null,
			author: null,
			publisher: metadata?.publisher ?? null,
			series: metadata?.series ?? null,
			volume: metadata?.volume ?? null,
			edition: metadata?.edition ?? null,
			identifier: metadata?.identifier ?? null,
			pages: metadata?.pages ?? null,
			description: metadata?.description ?? null,
			google_books_id: metadata?.googleBooksId ?? null,
			open_library_key: metadata?.openLibraryKey ?? null,
			amazon_asin: metadata?.amazonAsin ?? null,
			external_rating: metadata?.externalRating ?? null,
			external_rating_count: metadata?.externalRatingCount ?? null,
			cover: metadata?.cover ?? null,
			extension,
			filesize: body.byteLength,
			language: null,
			year: null
		});
		this.useCaseLogger.info(
			{
				event: 'library.book.created',
				originalStorageKey: title,
				storageKey: sanitizedKey,
				title: displayTitle,
				metadataFound: Boolean(metadata),
				extension,
				filesize: body.byteLength
			},
			'Library book created from PUT'
		);

		return apiOk({ success: true });
	}
}
