import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ImportLibraryBookCoverUseCase } from '$lib/server/application/use-cases/ImportLibraryBookCoverUseCase';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { Book, UpdateBookMetadataInput } from '$lib/server/domain/entities/Book';
import type { ManagedBookCoverResult } from '$lib/server/application/services/ManagedBookCoverService';

function createBook(overrides: Partial<Book>): Book {
	return {
		id: 1,
		zLibId: null,
		s3_storage_key: 'example.epub',
		title: 'Example',
		author: null,
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
		cover: 'https://books.google.com/books/content?id=test-cover',
		extension: 'epub',
		filesize: 10,
		language: null,
		year: null,
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

describe('ImportLibraryBookCoverUseCase', () => {
	test('imports an external cover URL and updates the book metadata', async () => {
		let updateInput: UpdateBookMetadataInput | null = null;
		let managedCoverInput:
			| {
					bookStorageKey: string;
					coverUrl: string | null | undefined;
			  }
			| null = null;

		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({});
			},
			async updateMetadata(_id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
				updateInput = metadata;
				return createBook({ cover: metadata.cover });
			}
		} as unknown as BookRepositoryPort;

		const useCase = new ImportLibraryBookCoverUseCase(repository, {
			async storeFromExternalUrl(input): Promise<ManagedBookCoverResult> {
				managedCoverInput = input;
				return {
					managedUrl: '/api/library/covers/example.epub.jpg',
					sourceUrl: 'https://books.google.com/books/content?id=test-cover'
				};
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			coverUrl: 'https://books.google.com/books/content?id=test-cover'
		});

		assert.equal(result.ok, true);
		assert.deepEqual(managedCoverInput, {
			bookStorageKey: 'example.epub',
			coverUrl: 'https://books.google.com/books/content?id=test-cover'
		});
		if (updateInput === null) {
			throw new Error('Expected updated metadata');
		}
		const updated = updateInput as UpdateBookMetadataInput;
		assert.equal(updated.cover, '/api/library/covers/example.epub.jpg');
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.cover, '/api/library/covers/example.epub.jpg');
	});

	test('rejects books whose current cover is already managed internally', async () => {
		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({
					cover: '/api/library/covers/example.epub.jpg'
				});
			}
		} as unknown as BookRepositoryPort;

		const useCase = new ImportLibraryBookCoverUseCase(repository, {
			async storeFromExternalUrl(): Promise<ManagedBookCoverResult> {
				throw new Error('should not be called');
			}
		});

		const result = await useCase.execute({ bookId: 1 });

		assert.equal(result.ok, false);
		assert.equal(result.error.status, 400);
		assert.equal(result.error.message, 'Cover is already stored internally');
	});
});
