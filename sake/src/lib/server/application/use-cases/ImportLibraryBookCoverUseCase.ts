import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { UpdateBookMetadataInput } from '$lib/server/domain/entities/Book';
import {
	ManagedBookCoverService,
	isManagedBookCoverUrl
} from '$lib/server/application/services/ManagedBookCoverService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface ImportLibraryBookCoverInput {
	bookId: number;
	coverUrl?: string | null;
}

interface ImportLibraryBookCoverResult {
	success: true;
	bookId: number;
	cover: string;
}

function trimToNull(value: string | null | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toUpdateMetadataInput(existing: Awaited<ReturnType<BookRepositoryPort['getById']>>, cover: string): UpdateBookMetadataInput {
	if (!existing) {
		throw new Error('Book is required');
	}

	return {
		zLibId: existing.zLibId,
		title: existing.title,
		author: existing.author,
		publisher: existing.publisher,
		series: existing.series,
		volume: existing.volume,
		series_index: existing.series_index,
		edition: existing.edition,
		identifier: existing.identifier,
		pages: existing.pages,
		description: existing.description,
		google_books_id: existing.google_books_id,
		open_library_key: existing.open_library_key,
		amazon_asin: existing.amazon_asin,
		external_rating: existing.external_rating,
		external_rating_count: existing.external_rating_count,
		cover,
		extension: existing.extension,
		filesize: existing.filesize,
		language: existing.language,
		year: existing.year,
		month: existing.month,
		day: existing.day
	};
}

export class ImportLibraryBookCoverUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly managedBookCoverService: Pick<ManagedBookCoverService, 'storeFromExternalUrl'>
	) {}

	async execute(
		input: ImportLibraryBookCoverInput
	): Promise<ApiResult<ImportLibraryBookCoverResult>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		const sourceCoverUrl = trimToNull(input.coverUrl) ?? trimToNull(book.cover);
		if (sourceCoverUrl === null) {
			return apiError('No cover URL available to import', 400);
		}

		if (isManagedBookCoverUrl(sourceCoverUrl)) {
			return apiError('Cover is already stored internally', 400);
		}

		const importedCover = await this.managedBookCoverService.storeFromExternalUrl({
			bookStorageKey: book.s3_storage_key,
			coverUrl: sourceCoverUrl
		});
		if (!importedCover.managedUrl) {
			return apiError('Failed to import cover image', 502);
		}

		await this.bookRepository.updateMetadata(
			input.bookId,
			toUpdateMetadataInput(book, importedCover.managedUrl)
		);

		return apiOk({
			success: true,
			bookId: input.bookId,
			cover: importedCover.managedUrl
		});
	}
}
