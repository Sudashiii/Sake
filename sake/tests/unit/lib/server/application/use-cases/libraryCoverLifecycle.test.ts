import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GetLibraryCoverUseCase } from '$lib/server/application/use-cases/GetLibraryCoverUseCase';
import { DeleteTrashedLibraryBookUseCase } from '$lib/server/application/use-cases/DeleteTrashedLibraryBookUseCase';
import { PurgeExpiredTrashUseCase } from '$lib/server/application/use-cases/PurgeExpiredTrashUseCase';
import { UpdateLibraryBookMetadataUseCase } from '$lib/server/application/use-cases/UpdateLibraryBookMetadataUseCase';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { Book, UpdateBookMetadataInput } from '$lib/server/domain/entities/Book';

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

describe('Library cover lifecycle use cases', () => {
	test('serves managed cover bytes with the correct image content type', async () => {
		let requestedKey: string | null = null;

		const storage = {
			async put(): Promise<void> {
				throw new Error('not implemented');
			},
			async get(key: string): Promise<Buffer> {
				requestedKey = key;
				return Buffer.from([1, 2, 3]);
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const useCase = new GetLibraryCoverUseCase(storage);
		const result = await useCase.execute('example.epub.jpg');

		assert.equal(result.ok, true);
		assert.equal(requestedKey, 'covers/example.epub.jpg');
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.contentType, 'image/jpeg');
		assert.equal(result.value.contentLength, '3');
	});

	test('rejects invalid managed cover file names before storage lookup', async () => {
		let requestedKey: string | null = null;

		const storage = {
			async put(): Promise<void> {
				throw new Error('not implemented');
			},
			async get(key: string): Promise<Buffer> {
				requestedKey = key;
				return Buffer.from([1, 2, 3]);
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const useCase = new GetLibraryCoverUseCase(storage);
		const result = await useCase.execute('../secret.jpg');

		assert.equal(result.ok, false);
		assert.equal(result.error.status, 404);
		assert.equal(requestedKey, null);
	});

	test('deletes managed covers when metadata replaces an internal cover URL', async () => {
		let updatedMetadata: UpdateBookMetadataInput | null = null;
		let deletedCoverStorageKey: string | null = null;

		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({
					cover: '/api/library/covers/example.epub.jpg'
				});
			},
			async updateMetadata(_id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
				updatedMetadata = metadata;
				return createBook(metadata);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new UpdateLibraryBookMetadataUseCase(repository, {
			async deleteForBookStorageKey(bookStorageKey: string): Promise<void> {
				deletedCoverStorageKey = bookStorageKey;
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			metadata: {
				cover: 'https://example.com/new-cover.jpg'
			}
		});

		assert.equal(result.ok, true);
		if (updatedMetadata === null) {
			throw new Error('Expected updated metadata');
		}
		const updated = updatedMetadata as UpdateBookMetadataInput;
		assert.equal(updated.cover, 'https://example.com/new-cover.jpg');
		assert.equal(deletedCoverStorageKey, 'example.epub');
	});

	test('does not delete managed covers when metadata switches to another internal cover URL', async () => {
		let deletedCoverStorageKey: string | null = null;

		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({
					cover: '/api/library/covers/example.epub.jpg'
				});
			},
			async updateMetadata(_id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
				return createBook(metadata);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new UpdateLibraryBookMetadataUseCase(repository, {
			async deleteForBookStorageKey(bookStorageKey: string): Promise<void> {
				deletedCoverStorageKey = bookStorageKey;
			}
		});

		const result = await useCase.execute({
			bookId: 1,
			metadata: {
				cover: '/api/library/covers/example.epub.webp'
			}
		});

		assert.equal(result.ok, true);
		assert.equal(deletedCoverStorageKey, null);
	});

	test('permanent trash deletion removes the library file, progress file, and managed covers', async () => {
		const deletedStorageKeys: string[] = [];
		let deletedCoverStorageKey: string | null = null;
		let deletedBookId: number | null = null;

		const storage = {
			async put(): Promise<void> {
				throw new Error('not implemented');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(key: string): Promise<void> {
				deletedStorageKeys.push(key);
			},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const repository = {
			async getByIdIncludingTrashed(): Promise<Book | undefined> {
				return createBook({
					deleted_at: '2026-03-19T00:00:00.000Z',
					trash_expires_at: '2026-04-18T00:00:00.000Z',
					progress_storage_key: 'example-progress.json',
					cover: '/api/library/covers/example.epub.jpg'
				});
			},
			async hasOtherBookWithStorageKey(): Promise<boolean> {
				return false;
			},
			async delete(bookId: number): Promise<void> {
				deletedBookId = bookId;
			}
		} as unknown as BookRepositoryPort;

		const useCase = new DeleteTrashedLibraryBookUseCase(repository, storage, {
			async deleteForBookStorageKey(bookStorageKey: string): Promise<void> {
				deletedCoverStorageKey = bookStorageKey;
			}
		} as never);

		const result = await useCase.execute({ bookId: 1 });

		assert.equal(result.ok, true);
		assert.deepEqual(deletedStorageKeys, ['library/example.epub', 'library/example-progress.json']);
		assert.equal(deletedCoverStorageKey, 'example.epub');
		assert.equal(deletedBookId, 1);
	});

	test('permanent trash deletion keeps shared storage when another row still references it', async () => {
		const deletedStorageKeys: string[] = [];
		let deletedCoverStorageKey: string | null = null;
		let deletedBookId: number | null = null;

		const storage = {
			async put(): Promise<void> {
				throw new Error('not implemented');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(key: string): Promise<void> {
				deletedStorageKeys.push(key);
			},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const repository = {
			async getByIdIncludingTrashed(): Promise<Book | undefined> {
				return createBook({
					id: 4,
					deleted_at: '2026-03-19T00:00:00.000Z',
					trash_expires_at: '2026-04-18T00:00:00.000Z',
					progress_storage_key: 'example-progress.json',
					cover: '/api/library/covers/example.epub.jpg'
				});
			},
			async hasOtherBookWithStorageKey(): Promise<boolean> {
				return true;
			},
			async delete(bookId: number): Promise<void> {
				deletedBookId = bookId;
			}
		} as unknown as BookRepositoryPort;

		const useCase = new DeleteTrashedLibraryBookUseCase(repository, storage, {
			async deleteForBookStorageKey(bookStorageKey: string): Promise<void> {
				deletedCoverStorageKey = bookStorageKey;
			}
		} as never);

		const result = await useCase.execute({ bookId: 4 });

		assert.equal(result.ok, true);
		assert.deepEqual(deletedStorageKeys, []);
		assert.equal(deletedCoverStorageKey, null);
		assert.equal(deletedBookId, 4);
	});

	test('expired trash purge removes managed covers for every purged book', async () => {
		const deletedCoverStorageKeys: string[] = [];
		const deletedBookIds: number[] = [];

		const storage = {
			async put(): Promise<void> {
				throw new Error('not implemented');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const repository = {
			async getExpiredTrash(): Promise<Book[]> {
				return [
					createBook({
						id: 1,
						deleted_at: '2026-03-01T00:00:00.000Z',
						trash_expires_at: '2026-03-10T00:00:00.000Z'
					}),
					createBook({
						id: 2,
						s3_storage_key: 'second.epub',
						deleted_at: '2026-03-01T00:00:00.000Z',
						trash_expires_at: '2026-03-10T00:00:00.000Z'
					})
				];
			},
			async listStorageKeysWithExternalReferences(
				storageKeys: string[],
				excludeBookIds: number[]
			): Promise<string[]> {
				assert.deepEqual(storageKeys, ['example.epub', 'second.epub']);
				assert.deepEqual(excludeBookIds, [1, 2]);
				return [];
			},
			async delete(bookId: number): Promise<void> {
				deletedBookIds.push(bookId);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new PurgeExpiredTrashUseCase(repository, storage, {
			async deleteForBookStorageKey(bookStorageKey: string): Promise<void> {
				deletedCoverStorageKeys.push(bookStorageKey);
			}
		} as never);

		const result = await useCase.execute('2026-03-19T00:00:00.000Z');

		assert.equal(result.ok, true);
		assert.deepEqual(deletedCoverStorageKeys, ['example.epub', 'second.epub']);
		assert.deepEqual(deletedBookIds, [1, 2]);
	});

	test('expired trash purge skips shared storage cleanup when another row still references the key', async () => {
		const deletedStorageKeys: string[] = [];
		const deletedCoverStorageKeys: string[] = [];
		const deletedBookIds: number[] = [];

		const storage = {
			async put(): Promise<void> {
				throw new Error('not implemented');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(key: string): Promise<void> {
				deletedStorageKeys.push(key);
			},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const repository = {
			async getExpiredTrash(): Promise<Book[]> {
				return [
					createBook({
						id: 5,
						deleted_at: '2026-03-01T00:00:00.000Z',
						trash_expires_at: '2026-03-10T00:00:00.000Z',
						progress_storage_key: 'example-progress.json'
					})
				];
			},
			async listStorageKeysWithExternalReferences(
				storageKeys: string[],
				excludeBookIds: number[]
			): Promise<string[]> {
				assert.deepEqual(storageKeys, ['example.epub']);
				assert.deepEqual(excludeBookIds, [5]);
				return ['example.epub'];
			},
			async delete(bookId: number): Promise<void> {
				deletedBookIds.push(bookId);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new PurgeExpiredTrashUseCase(repository, storage, {
			async deleteForBookStorageKey(bookStorageKey: string): Promise<void> {
				deletedCoverStorageKeys.push(bookStorageKey);
			}
		} as never);

		const result = await useCase.execute('2026-03-19T00:00:00.000Z');

		assert.equal(result.ok, true);
		assert.deepEqual(deletedStorageKeys, []);
		assert.deepEqual(deletedCoverStorageKeys, []);
		assert.deepEqual(deletedBookIds, [5]);
	});
});
