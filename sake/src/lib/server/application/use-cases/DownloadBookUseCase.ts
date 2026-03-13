import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { ZLibraryCredentials, ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import { EpubMetadataService } from '$lib/server/application/services/EpubMetadataService';
import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import { buildSanitizedBookFileName } from '$lib/server/domain/value-objects/StorageKeySanitizer';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';

interface UploadService {
	upload(fileName: string, data: Buffer | Uint8Array): Promise<void>;
}

interface DownloadBookUseCaseInput {
	request: ZDownloadBookRequest;
	credentials: ZLibraryCredentials;
}

interface DownloadBookUseCaseResult {
	success: true;
	fileData?: ArrayBuffer;
	responseHeaders?: Headers;
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
	const normalizedFallback =
		typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0 ? fallback : null;
	return normalizedFallback;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
	if (data.buffer instanceof ArrayBuffer) {
		if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
			return data.buffer;
		}

		return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
	}

	return Uint8Array.from(data).buffer as ArrayBuffer;
}

function buildDownloadHeaders(originalHeaders: Headers, byteLength: number, rewritten: boolean): Headers {
	const headers = new Headers(originalHeaders);

	// Always enforce actual payload length from the bytes we return.
	headers.set('content-length', String(byteLength));

	// If bytes changed, upstream integrity/encoding headers are no longer valid.
	if (rewritten) {
		headers.delete('content-encoding');
		headers.delete('transfer-encoding');
		headers.delete('content-range');
		headers.delete('etag');
		headers.delete('content-md5');
	}

	return headers;
}

export class DownloadBookUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'DownloadBookUseCase' });

	constructor(
		private readonly zlibrary: ZLibraryPort,
		private readonly bookRepository: BookRepositoryPort,
		private readonly uploadServiceFactory: () => UploadService,
		private readonly epubMetadataService = new EpubMetadataService(),
		private readonly externalMetadataService = new ExternalBookMetadataService()
	) {}

	async execute(input: DownloadBookUseCaseInput): Promise<ApiResult<DownloadBookUseCaseResult>> {
		const { request, credentials } = input;

		const loginResult = await this.zlibrary.tokenLogin(credentials.userId, credentials.userKey);
		if (!loginResult.ok) {
			return loginResult;
		}

		const downloadResult = await this.zlibrary.download(request.bookId, request.hash, credentials);
		if (!downloadResult.ok) {
			return downloadResult;
		}

		const fileData = await downloadResult.value.arrayBuffer();
		const downloadedBuffer = Buffer.from(fileData);
		let finalFileData: Uint8Array = downloadedBuffer;
		let rewrittenEpub = false;

		if (request.extension.toLowerCase() === 'epub') {
			const rewrittenEpubResult = await this.epubMetadataService.rewriteTitle(
				downloadedBuffer,
				request.title
			);

			if (rewrittenEpubResult.ok) {
				finalFileData = rewrittenEpubResult.value;
				rewrittenEpub = true;
			} else {
				this.useCaseLogger.warn(
					{
						event: 'epub.title.rewrite.skipped',
						bookId: request.bookId,
						reason: rewrittenEpubResult.error.message
					},
					'EPUB title rewrite skipped'
				);
			}
		}

		if (request.upload) {
			const key = buildSanitizedBookFileName(request.title, request.bookId, request.extension);
			const uploadService = this.uploadServiceFactory();
			await uploadService.upload(key, finalFileData);
			this.useCaseLogger.info(
				{ event: 'library.upload.completed', bookId: request.bookId, storageKey: key },
				'Uploaded book to library storage'
			);

			let externalMetadata: Awaited<ReturnType<ExternalBookMetadataService['lookup']>> | null = null;
			try {
				externalMetadata = await this.externalMetadataService.lookup({
					title: request.title,
					author: request.author ?? null,
					identifier: request.identifier ?? null,
					language: request.language ?? null
				});
			} catch (err: unknown) {
				this.useCaseLogger.warn(
					{
						event: 'library.metadata.lookup.failed',
						bookId: request.bookId,
						storageKey: key,
						error: toLogError(err)
					},
					'Metadata lookup failed during Z-Library add, continuing with source metadata only'
				);
			}

			await this.bookRepository.create({
				zLibId: request.bookId,
				s3_storage_key: key,
				title: request.title,
				author: pickText(request.author, null),
				publisher: pickText(request.publisher, externalMetadata?.publisher),
				series: pickText(request.series, externalMetadata?.series),
				volume: pickText(request.volume, externalMetadata?.volume),
				edition: pickText(request.edition, externalMetadata?.edition),
				identifier: pickText(request.identifier, externalMetadata?.identifier),
				pages: pickNumber(request.pages, externalMetadata?.pages),
				description: pickText(request.description, externalMetadata?.description),
				google_books_id: pickText(null, externalMetadata?.googleBooksId),
				open_library_key: pickText(null, externalMetadata?.openLibraryKey),
				amazon_asin: pickText(null, externalMetadata?.amazonAsin),
				external_rating: pickNumber(null, externalMetadata?.externalRating),
				external_rating_count:
					typeof externalMetadata?.externalRatingCount === 'number' &&
					Number.isFinite(externalMetadata.externalRatingCount) &&
					externalMetadata.externalRatingCount >= 0
						? externalMetadata.externalRatingCount
						: null,
				cover: pickText(request.cover, externalMetadata?.cover),
				extension: pickText(request.extension, null),
				filesize: pickNumber(request.filesize, null),
				language: pickText(request.language, null),
				year: pickNumber(request.year, null)
			});
			this.useCaseLogger.info(
				{
					event: 'library.book.created',
					bookId: request.bookId,
					storageKey: key,
					metadataFound: Boolean(externalMetadata)
				},
				'Created library book record'
			);
		}

		if (request.downloadToDevice === false) {
			return apiOk({ success: true });
		}

		return apiOk({
			success: true,
			fileData: toArrayBuffer(finalFileData),
			responseHeaders: buildDownloadHeaders(
				downloadResult.value.headers,
				finalFileData.byteLength,
				rewrittenEpub
			)
		});
	}
}
