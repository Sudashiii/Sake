import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { UpdateBookMetadataInput } from '$lib/server/domain/entities/Book';

export function toUpdateMetadataInput(
	existing: Awaited<ReturnType<BookRepositoryPort['getById']>>,
	cover: string
): UpdateBookMetadataInput {
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
		day: existing.day,
		createdAt: existing.createdAt
	};
}
