import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface RefetchLibraryBookMetadataInput {
	bookId: number;
}

interface RefetchLibraryBookMetadataResult {
	success: true;
	book: {
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
	};
}

function hasText(value: string | null | undefined): boolean {
	return typeof value === 'string' && value.trim().length > 0;
}

function keepOrFillText(current: string | null | undefined, fallback: string | null | undefined): string | null {
	if (hasText(current)) {
		return current ?? null;
	}
	return hasText(fallback) ? fallback ?? null : null;
}

function keepOrFillNumber(current: number | null | undefined, fallback: number | null | undefined): number | null {
	return current !== null && current !== undefined ? current : fallback ?? null;
}

function keepOrFillPages(current: number | null | undefined, fallback: number | null | undefined): number | null {
	const normalizedCurrent = typeof current === 'number' && Number.isFinite(current) && current > 0 ? current : null;
	const normalizedFallback =
		typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0 ? fallback : null;

	return normalizedCurrent ?? normalizedFallback;
}

export class RefetchLibraryBookMetadataUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly externalMetadataService = new ExternalBookMetadataService()
	) {}

	async execute(
		input: RefetchLibraryBookMetadataInput
	): Promise<ApiResult<RefetchLibraryBookMetadataResult>> {
		const existingBook = await this.bookRepository.getById(input.bookId);
		if (!existingBook) {
			return apiError('Book not found', 404);
		}

		const enriched = await this.externalMetadataService.lookup({
			title: existingBook.title,
			author: existingBook.author ?? null,
			identifier: existingBook.identifier ?? null,
			language: existingBook.language ?? null
		});

		const updated = await this.bookRepository.updateMetadata(existingBook.id, {
			zLibId: existingBook.zLibId,
			title: existingBook.title,
			author: existingBook.author,
			publisher: keepOrFillText(
				existingBook.publisher,
				enriched.publisher
			),
			series: keepOrFillText(existingBook.series, enriched.series),
			volume: keepOrFillText(existingBook.volume, enriched.volume),
			edition: keepOrFillText(existingBook.edition, enriched.edition),
			identifier: keepOrFillText(
				existingBook.identifier,
				enriched.identifier
			),
			pages: keepOrFillPages(existingBook.pages, enriched.pages),
			description: keepOrFillText(
				existingBook.description,
				enriched.description
			),
			google_books_id: keepOrFillText(existingBook.google_books_id, enriched.googleBooksId),
			open_library_key: keepOrFillText(existingBook.open_library_key, enriched.openLibraryKey),
			amazon_asin: keepOrFillText(existingBook.amazon_asin, enriched.amazonAsin),
			external_rating: keepOrFillNumber(existingBook.external_rating, enriched.externalRating),
			external_rating_count: keepOrFillNumber(
				existingBook.external_rating_count,
				enriched.externalRatingCount
			),
			cover: keepOrFillText(existingBook.cover, enriched.cover),
			extension: existingBook.extension,
			filesize: existingBook.filesize,
			language: existingBook.language,
			year: existingBook.year
		});

		return apiOk({
			success: true,
			book: {
				id: updated.id,
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
				googleBooksId: updated.google_books_id,
				openLibraryKey: updated.open_library_key,
				amazonAsin: updated.amazon_asin,
				externalRating: updated.external_rating,
				externalRatingCount: updated.external_rating_count,
				cover: updated.cover,
				extension: updated.extension,
				filesize: updated.filesize,
				language: updated.language,
				year: updated.year
			}
		});
	}
}
