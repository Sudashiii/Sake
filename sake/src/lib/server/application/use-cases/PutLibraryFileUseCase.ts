import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import {
	EpubMetadataService,
	type ExtractedEpubUploadData,
	type ExtractedUploadMetadata
} from '$lib/server/application/services/EpubMetadataService';
import {
	ManagedBookCoverService,
	type ManagedBookCoverResult
} from '$lib/server/application/services/ManagedBookCoverService';
import {
	LibraryImportCollisionService,
	type LibraryImportOutcome
} from '$lib/server/application/services/LibraryImportCollisionService';
import { sanitizeLibraryStorageKey } from '$lib/server/domain/value-objects/StorageKeySanitizer';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { ExternalBookMetadata } from '$lib/server/application/services/ExternalBookMetadataService';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import type { QueueableSearchProviderId } from '$lib/types/Search/QueueSearchBookRequest';
import { resolveSeriesIndex } from '$lib/utils/series';

interface PutLibraryFileResult {
	success: true;
	outcome: LibraryImportOutcome;
}

type ExternalMetadataLookup = Pick<ExternalBookMetadataService, 'lookup'>;
type UploadDataExtractor = Pick<EpubMetadataService, 'extractUploadData'>;
type ManagedCoverStorage = Pick<ManagedBookCoverService, 'storeFromSearchImport' | 'storeFromBuffer'>;

interface SourceImportMetadata {
	provider: QueueableSearchProviderId;
	coverUrl?: string | null;
	series?: string | null;
	volume?: string | null;
	seriesIndex?: number | null;
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

function pickText(primary: string | null | undefined, fallback: string | null | undefined): string | null {
	const normalizedPrimary = typeof primary === 'string' ? primary.trim() : null;
	if (normalizedPrimary && normalizedPrimary.length > 0) {
		return normalizedPrimary;
	}

	const normalizedFallback = typeof fallback === 'string' ? fallback.trim() : null;
	return normalizedFallback && normalizedFallback.length > 0 ? normalizedFallback : null;
}

function pickNumber(primary: number | null | undefined, fallback: number | null | undefined): number | null {
	const normalizedPrimary =
		typeof primary === 'number' && Number.isFinite(primary) && primary > 0 ? primary : null;
	if (normalizedPrimary !== null) {
		return normalizedPrimary;
	}

	return typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

export class PutLibraryFileUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'PutLibraryFileUseCase' });

	constructor(
		private readonly storage: StoragePort,
		private readonly bookRepository: BookRepositoryPort,
		private readonly managedBookCoverService: ManagedCoverStorage = new ManagedBookCoverService(storage),
		private readonly epubMetadataService: UploadDataExtractor = new EpubMetadataService(),
		private readonly externalMetadataService: ExternalMetadataLookup = new ExternalBookMetadataService(),
		private readonly importCollisionService: LibraryImportCollisionService = new LibraryImportCollisionService(
			bookRepository
		)
	) {}

	async execute(
		title: string,
		body: ArrayBuffer,
		sourceImport?: SourceImportMetadata
	): Promise<ApiResult<PutLibraryFileResult>> {
		if (body.byteLength === 0) {
			return apiError('Uploaded file is empty', 400);
		}

		const sanitizedKey = sanitizeLibraryStorageKey(title);
		const existingMatch = await this.importCollisionService.findStorageKeyMatch(sanitizedKey);
		if (existingMatch) {
			const existingBook = existingMatch.book;
			const message = existingBook.deleted_at
				? `A trashed book with this file name already exists. Rename the new file or permanently delete "${existingBook.title}" from trash first.`
				: `Book already exists in library (storage key: ${sanitizedKey})`;
			this.useCaseLogger.warn(
				{
					event: 'library.file.upload.duplicate',
					originalStorageKey: title,
					storageKey: sanitizedKey,
					existingBookId: existingBook.id,
					existingBookDeletedAt: existingBook.deleted_at
				},
				'Manual upload rejected because storage key already exists'
			);
			return apiError(message, 409);
		}

		const fileBuffer = Buffer.from(body);
		const extension = extensionFromFileName(sanitizedKey);
		let extractedMetadata: ExtractedUploadMetadata | null = null;
		let extractedCover: ExtractedEpubUploadData['cover'] = null;
		if (extension === 'epub') {
			const extractedUploadData = await this.epubMetadataService.extractUploadData(fileBuffer);
			extractedMetadata = extractedUploadData.metadata;
			extractedCover = extractedUploadData.cover;
		}

		const fallbackTitle = stripExtension(title).trim() || stripExtension(sanitizedKey);
		const displayTitle = pickText(extractedMetadata?.title, fallbackTitle) ?? sanitizedKey;
		const key = `library/${sanitizedKey}`;
		await this.storage.put(key, fileBuffer, 'application/octet-stream');
		this.useCaseLogger.info(
			{ event: 'library.file.uploaded', originalStorageKey: title, storageKey: sanitizedKey },
			'Library file uploaded'
		);

		let metadata: ExternalBookMetadata | null = null;
		try {
			metadata = await this.externalMetadataService.lookup({
				title: displayTitle,
				author: extractedMetadata?.author ?? null,
				identifier: extractedMetadata?.identifier ?? null,
				language: extractedMetadata?.language ?? null
			});
		} catch (err: unknown) {
			this.useCaseLogger.warn(
				{
					event: 'library.metadata.lookup.failed',
					originalStorageKey: title,
					storageKey: sanitizedKey,
					lookupTitle: displayTitle,
					lookupAuthor: extractedMetadata?.author ?? null,
					lookupIdentifier: extractedMetadata?.identifier ?? null,
					lookupLanguage: extractedMetadata?.language ?? null,
					error: toLogError(err)
				},
				'Metadata lookup failed during manual upload, continuing with empty metadata'
			);
		}

		let embeddedManagedCover: ManagedBookCoverResult = { managedUrl: null, sourceUrl: null };
		if (extractedCover) {
			embeddedManagedCover = await this.managedBookCoverService.storeFromBuffer({
				bookStorageKey: sanitizedKey,
				coverBuffer: extractedCover.data,
				contentType: extractedCover.contentType
			});
		}

		let managedCover: ManagedBookCoverResult = { managedUrl: null, sourceUrl: null };
		if (!embeddedManagedCover.managedUrl && sourceImport?.coverUrl && sourceImport.provider) {
			managedCover = await this.managedBookCoverService.storeFromSearchImport({
				bookStorageKey: sanitizedKey,
				provider: sourceImport.provider,
				coverUrl: sourceImport.coverUrl
			});
		}

		await this.bookRepository.create({
			s3_storage_key: sanitizedKey,
			title: displayTitle,
			zLibId: null,
			author: pickText(extractedMetadata?.author, null),
			publisher: pickText(extractedMetadata?.publisher, metadata?.publisher),
			series: pickText(sourceImport?.series, metadata?.series),
			volume: pickText(sourceImport?.volume, metadata?.volume),
			series_index: resolveSeriesIndex({
				seriesIndex: sourceImport?.seriesIndex,
				volume: sourceImport?.volume,
				fallbackSeriesIndex: metadata?.seriesIndex,
				fallbackVolume: metadata?.volume
			}),
			edition: metadata?.edition ?? null,
			identifier: pickText(extractedMetadata?.identifier, metadata?.identifier),
			pages: metadata?.pages ?? null,
			description: pickText(extractedMetadata?.description, metadata?.description),
			google_books_id: metadata?.googleBooksId ?? null,
			open_library_key: metadata?.openLibraryKey ?? null,
			amazon_asin: metadata?.amazonAsin ?? null,
			external_rating: metadata?.externalRating ?? null,
			external_rating_count: metadata?.externalRatingCount ?? null,
			cover: pickText(
				embeddedManagedCover.managedUrl,
				pickText(managedCover.managedUrl, pickText(managedCover.sourceUrl, metadata?.cover))
			),
			extension,
			filesize: body.byteLength,
			language: pickText(extractedMetadata?.language, null),
			year: pickNumber(extractedMetadata?.year, null)
		});
		this.useCaseLogger.info(
			{
				event: 'library.book.created',
				originalStorageKey: title,
				storageKey: sanitizedKey,
				title: displayTitle,
				embeddedMetadataFound: Boolean(extractedMetadata),
				embeddedCoverFound: Boolean(extractedCover),
				externalMetadataFound: Boolean(metadata),
				extension,
				filesize: body.byteLength
			},
			'Library book created from PUT'
		);

		return apiOk({ success: true, outcome: 'created' });
	}
}
