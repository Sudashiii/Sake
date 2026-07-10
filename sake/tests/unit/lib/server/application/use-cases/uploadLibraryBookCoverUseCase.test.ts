import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { UploadLibraryBookCoverUseCase } from '$lib/server/application/use-cases/UploadLibraryBookCoverUseCase';
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
		cover: null,
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
		createdAt: null,
		deleted_at: null,
		trash_expires_at: null,
		...overrides
	};
}

describe('UploadLibraryBookCoverUseCase', () => {
	test('uploads an image buffer and updates the book metadata', async () => {
		let capturedBookStorageKey: string | null = null;
		let capturedContentType: string | null = null;
		let capturedByteLength: number | null = null;
		let capturedUpdatedCover: string | null = null;

		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({});
			},
			async updateMetadata(_id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
				capturedUpdatedCover = metadata.cover;
				return createBook({ cover: metadata.cover });
			}
		} as unknown as BookRepositoryPort;

		const useCase = new UploadLibraryBookCoverUseCase(repository, {
			async storeFromBuffer(input): Promise<ManagedBookCoverResult> {
				capturedBookStorageKey = input.bookStorageKey;
				capturedContentType = input.contentType;
				capturedByteLength = input.coverBuffer.byteLength;
				return {
					managedUrl: '/api/library/covers/example.epub.webp',
					sourceUrl: null
				};
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			fileData: new Uint8Array([1, 2, 3, 4]).buffer,
			contentType: 'image/webp'
		});

		assert.equal(result.ok, true);
		if (
			capturedBookStorageKey === null ||
			capturedContentType === null ||
			capturedByteLength === null ||
			capturedUpdatedCover === null
		) {
			throw new Error('Expected cover upload side effects');
		}
		assert.equal(capturedBookStorageKey, 'example.epub');
		assert.equal(capturedContentType, 'image/webp');
		assert.equal(capturedByteLength, 4);
		assert.equal(capturedUpdatedCover, '/api/library/covers/example.epub.webp');
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.cover, '/api/library/covers/example.epub.webp');
	});

	test('rejects non-image uploads before storing', async () => {
		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({});
			}
		} as unknown as BookRepositoryPort;

		const useCase = new UploadLibraryBookCoverUseCase(repository, {
			async storeFromBuffer(): Promise<ManagedBookCoverResult> {
				throw new Error('should not be called');
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			fileData: new Uint8Array([1, 2, 3]).buffer,
			contentType: 'application/pdf'
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected an error');
		}
		assert.equal(result.error.status, 400);
		assert.equal(result.error.message, 'Cover upload must be an image file');
	});
});
