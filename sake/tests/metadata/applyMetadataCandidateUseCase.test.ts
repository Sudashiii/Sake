import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type {
	MetadataCandidate,
	MetadataCoverCandidate
} from '$lib/server/application/ports/MetadataProviderPort';
import type { ManagedBookCoverResult } from '$lib/server/application/services/ManagedBookCoverService';
import { ApplyMetadataCandidateUseCase } from '$lib/server/application/use-cases/ApplyMetadataCandidateUseCase';
import type { Book, UpdateBookMetadataInput } from '$lib/server/domain/entities/Book';

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
		identifier: null,
		pages: null,
		description: null,
		google_books_id: null,
		open_library_key: null,
		amazon_asin: null,
		external_rating: null,
		external_rating_count: null,
		cover: 'https://books.google.com/books/content?id=old',
		extension: 'epub',
		filesize: 10,
		language: null,
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
		createdAt: '2026-01-01T00:00:00.000Z',
		deleted_at: null,
		trash_expires_at: null,
		...overrides
	};
}

function createCandidate(overrides: Partial<MetadataCandidate> = {}): MetadataCandidate {
	return {
		providerId: 'googlebooks',
		providerScore: 1,
		identifiers: {
			isbn10: '0441172695',
			isbn13: '9780441172696',
			asin: 'B000FC1BN8',
			googleBooksId: 'gb-dune-messiah',
			openLibraryKey: 'OL893415W',
			hardcoverId: null
		},
		title: 'Dune Messiah',
		subtitle: null,
		authors: ['Frank Herbert'],
		description: 'The second Dune novel.',
		descriptionFormat: 'text',
		subjects: ['Science Fiction'],
		series: 'Dune',
		seriesIndex: 2,
		publisher: 'Ace',
		publishedDate: {
			year: 1969,
			month: 7,
			day: 1
		},
		language: 'en',
		pageCount: 352,
		covers: [
			{
				url: 'https://books.google.com/books/content?id=gb-dune-messiah',
				source: 'googlebooks'
			}
		],
		rating: {
			average: 4.1,
			count: 12345
		},
		sourceUrl: 'https://books.google.com/books?id=gb-dune-messiah',
		...overrides
	};
}

function applyMetadataToBook(book: Book, metadata: UpdateBookMetadataInput): Book {
	return {
		...book,
		zLibId: metadata.zLibId,
		title: metadata.title,
		author: metadata.author,
		publisher: metadata.publisher,
		series: metadata.series,
		volume: metadata.volume,
		series_index: metadata.series_index,
		edition: metadata.edition,
		identifier: metadata.identifier,
		pages: metadata.pages,
		description: metadata.description,
		google_books_id: metadata.google_books_id,
		open_library_key: metadata.open_library_key,
		amazon_asin: metadata.amazon_asin,
		external_rating: metadata.external_rating,
		external_rating_count: metadata.external_rating_count,
		cover: metadata.cover,
		extension: metadata.extension,
		filesize: metadata.filesize,
		language: metadata.language,
		year: metadata.year,
		month: metadata.month,
		day: metadata.day,
		createdAt: metadata.createdAt
	};
}

describe('ApplyMetadataCandidateUseCase', () => {
	test('applies selected candidate fields and imports a selected cover', async () => {
		const book = createBook();
		let capturedUpdate: UpdateBookMetadataInput | null = null;
		let capturedCoverInput:
			| {
					bookStorageKey: string;
					coverUrl: string | null | undefined;
			  }
			| null = null;
		const coverChoice: MetadataCoverCandidate = {
			url: 'https://books.google.com/books/content?id=gb-dune-messiah',
			source: 'googlebooks'
		};

		const repository = {
			async getById(): Promise<Book | undefined> {
				return book;
			},
			async updateMetadata(_id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
				capturedUpdate = metadata;
				return applyMetadataToBook(book, metadata);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new ApplyMetadataCandidateUseCase(repository, {
			async storeFromExternalUrl(input): Promise<ManagedBookCoverResult> {
				capturedCoverInput = input;
				return {
					managedUrl: '/api/library/covers/dune.epub.jpg?v=123',
					sourceUrl: input.coverUrl ?? null
				};
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			candidate: createCandidate(),
			fieldSelections: [
				'title',
				'author',
				'publisher',
				'series',
				'seriesIndex',
				'identifier',
				'pages',
				'description',
				'language',
				'publishedDate',
				'googleBooksId',
				'openLibraryKey',
				'amazonAsin',
				'externalRating',
				'externalRatingCount'
			],
			coverChoice
		});

		assert.equal(result.ok, true);
		assert.deepEqual(capturedCoverInput, {
			bookStorageKey: 'dune.epub',
			coverUrl: 'https://books.google.com/books/content?id=gb-dune-messiah'
		});
		if (capturedUpdate === null) {
			throw new Error('Expected metadata update');
		}
		const update = capturedUpdate as UpdateBookMetadataInput;
		assert.equal(update.title, 'Dune Messiah');
		assert.equal(update.author, 'Frank Herbert');
		assert.equal(update.publisher, 'Ace');
		assert.equal(update.series, 'Dune');
		assert.equal(update.series_index, 2);
		assert.equal(update.identifier, '9780441172696');
		assert.equal(update.pages, 352);
		assert.equal(update.description, 'The second Dune novel.');
		assert.equal(update.language, 'en');
		assert.equal(update.year, 1969);
		assert.equal(update.month, 7);
		assert.equal(update.day, 1);
		assert.equal(update.google_books_id, 'gb-dune-messiah');
		assert.equal(update.open_library_key, 'OL893415W');
		assert.equal(update.amazon_asin, 'B000FC1BN8');
		assert.equal(update.external_rating, 4.1);
		assert.equal(update.external_rating_count, 12345);
		assert.equal(update.cover, '/api/library/covers/dune.epub.jpg?v=123');
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.book.title, 'Dune Messiah');
		assert.equal(result.value.book.cover, '/api/library/covers/dune.epub.jpg?v=123');
	});

	test('returns 404 when the book does not exist', async () => {
		let updateCalled = false;
		let coverCalled = false;
		const repository = {
			async getById(): Promise<Book | undefined> {
				return undefined;
			},
			async updateMetadata(): Promise<Book> {
				updateCalled = true;
				throw new Error('should not be called');
			}
		} as unknown as BookRepositoryPort;

		const useCase = new ApplyMetadataCandidateUseCase(repository, {
			async storeFromExternalUrl(): Promise<ManagedBookCoverResult> {
				coverCalled = true;
				throw new Error('should not be called');
			}
		});

		const result = await useCase.execute({
			bookId: 404,
			candidate: createCandidate(),
			fieldSelections: ['title']
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected missing book to fail');
		}
		assert.equal(result.error.status, 404);
		assert.equal(result.error.message, 'Book not found');
		assert.equal(updateCalled, false);
		assert.equal(coverCalled, false);
	});

	test('rejects empty field selections without a cover choice', async () => {
		let getByIdCalled = false;
		const repository = {
			async getById(): Promise<Book | undefined> {
				getByIdCalled = true;
				return createBook();
			}
		} as unknown as BookRepositoryPort;

		const useCase = new ApplyMetadataCandidateUseCase(repository, {
			async storeFromExternalUrl(): Promise<ManagedBookCoverResult> {
				throw new Error('should not be called');
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			candidate: createCandidate(),
			fieldSelections: []
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected empty selection to fail');
		}
		assert.equal(result.error.status, 400);
		assert.equal(result.error.message, 'At least one field selection or cover choice is required');
		assert.equal(getByIdCalled, false);
	});

	test('does not update fields when cover import fails', async () => {
		let updateCalled = false;
		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook();
			},
			async updateMetadata(): Promise<Book> {
				updateCalled = true;
				throw new Error('should not be called');
			}
		} as unknown as BookRepositoryPort;

		const useCase = new ApplyMetadataCandidateUseCase(repository, {
			async storeFromExternalUrl(): Promise<ManagedBookCoverResult> {
				return {
					managedUrl: null,
					sourceUrl: 'https://example.com/cover.jpg'
				};
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			candidate: createCandidate(),
			fieldSelections: ['title'],
			coverChoice: {
				url: 'https://example.com/cover.jpg',
				source: 'manual'
			}
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected cover import failure');
		}
		assert.equal(result.error.status, 502);
		assert.equal(result.error.message, 'Failed to import cover image');
		assert.equal(updateCalled, false);
	});
});
