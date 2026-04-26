import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type {
	MetadataCandidate,
	MetadataProviderCapabilities,
	MetadataProviderPort,
	MetadataQuery
} from '$lib/server/application/ports/MetadataProviderPort';
import { MetadataAggregatorService } from '$lib/server/application/services/MetadataAggregatorService';
import { SearchMetadataCandidatesUseCase } from '$lib/server/application/use-cases/SearchMetadataCandidatesUseCase';
import type { Book } from '$lib/server/domain/entities/Book';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';

function createBook(overrides: Partial<Book> = {}): Book {
	return {
		id: 1,
		zLibId: null,
		s3_storage_key: 'dune.epub',
		title: 'Dune',
		author: 'Frank Herbert',
		publisher: null,
		series: null,
		volume: null,
		series_index: null,
		edition: null,
		identifier: '9780441172719',
		pages: null,
		description: null,
		google_books_id: 'gb-dune',
		open_library_key: 'OL893415W',
		amazon_asin: null,
		external_rating: null,
		external_rating_count: null,
		cover: null,
		extension: 'epub',
		filesize: 10,
		language: 'en',
		year: null,
		month: null,
		day: null,
		progress_storage_key: null,
		progress_updated_at: null,
		progress_percent: null,
		progress_before_read: null,
		rating: null,
		read_at: null,
		archived_at: null,
		exclude_from_new_books: false,
		createdAt: null,
		deleted_at: null,
		trash_expires_at: null,
		...overrides
	};
}

class CapturingMetadataProvider implements MetadataProviderPort {
	readonly id: MetadataProviderId = 'openlibrary';
	readonly capabilities: MetadataProviderCapabilities = {
		touchedFields: new Set(['title']),
		hasCover: false,
		hasRating: false,
		requiresIsbn: false
	};
	query: MetadataQuery | null = null;

	async lookup(query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>> {
		this.query = query;
		return apiOk([]);
	}
}

function createUseCase(book: Book | undefined, provider = new CapturingMetadataProvider()) {
	const repository = {
		async getById(): Promise<Book | undefined> {
			return book;
		}
	} as unknown as BookRepositoryPort;

	return {
		provider,
		useCase: new SearchMetadataCandidatesUseCase(
			new MetadataAggregatorService([provider]),
			repository
		)
	};
}

describe('SearchMetadataCandidatesUseCase', () => {
	test('merges book metadata with query overrides before lookup', async () => {
		const { provider, useCase } = createUseCase(createBook());

		const result = await useCase.execute({
			bookId: 1,
			query: {
				title: 'Dune Messiah',
				limit: 3
			}
		});

		assert.equal(result.ok, true);
		assert.deepEqual(provider.query, {
			title: 'Dune Messiah',
			author: 'Frank Herbert',
			isbn: '9780441172719',
			language: 'en',
			googleBooksId: 'gb-dune',
			openLibraryKey: 'OL893415W',
			limit: 3
		});
	});

	test('returns 404 when a requested book does not exist', async () => {
		const { provider, useCase } = createUseCase(undefined);

		const result = await useCase.execute({ bookId: 404 });

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected missing book to fail');
		}
		assert.equal(result.error.status, 404);
		assert.equal(result.error.message, 'Book not found');
		assert.equal(provider.query, null);
	});

	test('returns 400 when neither bookId nor query is provided', async () => {
		const { provider, useCase } = createUseCase(createBook());

		const result = await useCase.execute({});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected empty input to fail');
		}
		assert.equal(result.error.status, 400);
		assert.equal(result.error.message, 'Either bookId or query must be provided');
		assert.equal(provider.query, null);
	});
});
