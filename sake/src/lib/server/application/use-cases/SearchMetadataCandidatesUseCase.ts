import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { MetadataQuery } from '$lib/server/application/ports/MetadataProviderPort';
import {
	MetadataAggregatorService,
	type MetadataAggregatorResult
} from '$lib/server/application/services/MetadataAggregatorService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

export interface SearchMetadataCandidatesInput {
	bookId?: number;
	query?: MetadataQuery;
}

export type SearchMetadataCandidatesResult = MetadataAggregatorResult;

export class SearchMetadataCandidatesUseCase {
	constructor(
		private readonly aggregator: MetadataAggregatorService,
		private readonly bookRepository: BookRepositoryPort
	) {}

	async execute(
		input: SearchMetadataCandidatesInput
	): Promise<ApiResult<SearchMetadataCandidatesResult>> {
		if (input.bookId == null && input.query == null) {
			return apiError('Either bookId or query must be provided', 400);
		}

		let query: MetadataQuery;

		if (input.bookId != null) {
			const book = await this.bookRepository.getById(input.bookId);
			if (!book) {
				return apiError('Book not found', 404);
			}
			query = {
				title: book.title,
				author: book.author ?? null,
				isbn: book.identifier ?? null,
				language: book.language ?? null,
				googleBooksId: book.google_books_id ?? null,
				openLibraryKey: book.open_library_key ?? null,
				...input.query
			};
		} else {
			query = input.query!;
		}

		const result = await this.aggregator.lookup(query);
		return apiOk(result);
	}
}
