import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ExportDeviceLibraryBookUseCase } from '$lib/server/application/use-cases/ExportDeviceLibraryBookUseCase';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { DeviceDownloadRepositoryPort } from '$lib/server/application/ports/DeviceDownloadRepositoryPort';
import type { DeviceProgressDownloadRepositoryPort } from '$lib/server/application/ports/DeviceProgressDownloadRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { CreateBookInput, Book } from '$lib/server/domain/entities/Book';
import { apiOk } from '$lib/server/http/api';

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
	return Uint8Array.from(buffer).buffer as ArrayBuffer;
}

function createBookRecord(input: CreateBookInput, overrides: Partial<Book> = {}): Book {
	return {
		id: 1,
		...input,
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

function createBook(overrides: Partial<Book> = {}): Book {
	return createBookRecord(
		{
			s3_storage_key: 'Book_Title.epub',
			title: 'Book Title',
			zLibId: null,
			author: null,
			publisher: null,
			series: null,
			volume: null,
			series_index: null,
			edition: null,
			identifier: null,
			pages: 300,
			description: null,
			google_books_id: null,
			open_library_key: null,
			amazon_asin: null,
			external_rating: null,
			external_rating_count: null,
			cover: null,
			extension: 'epub',
			filesize: 12,
			language: null,
			year: null
		},
		overrides
	);
}

describe('ExportDeviceLibraryBookUseCase', () => {
	test('creates a new library book without a sidecar and marks it downloaded for the device', async () => {
		let ensuredDownload: { deviceId: string; bookId: number } | null = null;
		let importerCalls = 0;

		const createdBook = createBook({ id: 42 });
		const bookRepository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async getByStorageKey(storageKey: string): Promise<Book | undefined> {
				return storageKey === 'Book_Title.epub' ? createdBook : undefined;
			}
		} as unknown as BookRepositoryPort;

		const deviceDownloadRepository = {
			async ensureByDeviceAndBook(input: {
				deviceId: string;
				bookId: number;
			}): Promise<{ id: number; deviceId: string; bookId: number }> {
				ensuredDownload = input;
				return { id: 1, ...input };
			}
		} as unknown as DeviceDownloadRepositoryPort;

		const deviceProgressDownloadRepository = {
			async upsertByDeviceAndBook(): Promise<never> {
				throw new Error('unexpected progress marker write');
			}
		} as unknown as DeviceProgressDownloadRepositoryPort;

		const storage = {
			async put(): Promise<void> {
				throw new Error('unexpected storage.put');
			},
			async get(): Promise<Buffer> {
				throw new Error('unexpected storage.get');
			},
			async delete(): Promise<void> {
				throw new Error('unexpected storage.delete');
			},
			async list(): Promise<[]> {
				throw new Error('unexpected storage.list');
			}
		} as StoragePort;

		const useCase = new ExportDeviceLibraryBookUseCase(
			bookRepository,
			deviceDownloadRepository,
			deviceProgressDownloadRepository,
			storage,
			{
				async execute(): Promise<ReturnType<typeof apiOk<{ success: true; outcome: 'created' }>>> {
					importerCalls += 1;
					return apiOk({ success: true, outcome: 'created' });
				}
			}
		);

		const result = await useCase.execute({
			deviceId: 'device-1',
			fileName: 'Book Title.epub',
			fileData: toArrayBuffer(Buffer.from('book-data'))
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.equal(importerCalls, 1);
		assert.deepEqual(ensuredDownload, { deviceId: 'device-1', bookId: 42 });
		assert.deepEqual(result.value, {
			success: true,
			bookOutcome: 'created',
			sidecarOutcome: 'missing'
		});
	});

	test('imports a new sidecar as baseline progress without going through progress history', async () => {
		type StoredSidecar = {
			key: string;
			body: Buffer | Uint8Array | NodeJS.ReadableStream;
			contentType?: string;
		};
		let updatedProgress:
			| {
					bookId: number;
					progressKey: string;
					progressPercent: number | null;
					progressUpdatedAt?: string | null;
			  }
			| null = null;
		let storedSidecar: StoredSidecar | null = null;
		let progressMarker:
			| {
					deviceId: string;
					bookId: number;
					progressUpdatedAt: string;
			  }
			| null = null;

		const createdBook = createBook({ id: 7 });
		const bookRepository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async getByStorageKey(): Promise<Book | undefined> {
				return createdBook;
			},
			async updateProgress(
				bookId: number,
				progressKey: string,
				progressPercent: number | null,
				progressUpdatedAt?: string | null
			): Promise<void> {
				updatedProgress = { bookId, progressKey, progressPercent, progressUpdatedAt };
			}
		} as unknown as BookRepositoryPort;

		const deviceDownloadRepository = {
			async ensureByDeviceAndBook(input: {
				deviceId: string;
				bookId: number;
			}): Promise<{ id: number; deviceId: string; bookId: number }> {
				return { id: 1, ...input };
			}
		} as unknown as DeviceDownloadRepositoryPort;

		const deviceProgressDownloadRepository = {
			async upsertByDeviceAndBook(input: {
				deviceId: string;
				bookId: number;
				progressUpdatedAt: string;
			}): Promise<{ id: number; deviceId: string; bookId: number; progressUpdatedAt: string }> {
				progressMarker = input;
				return { id: 1, ...input };
			}
		} as unknown as DeviceProgressDownloadRepositoryPort;

		const storage = {
			async exists(): Promise<boolean> {
				return false;
			},
			async put(
				key: string,
				body: Buffer | Uint8Array | NodeJS.ReadableStream,
				contentType?: string
			): Promise<void> {
				storedSidecar = { key, body, contentType };
			},
			async get(): Promise<Buffer> {
				throw new Error('missing existing sidecar');
			},
			async delete(): Promise<void> {
				throw new Error('unexpected storage.delete');
			},
			async list(): Promise<[]> {
				throw new Error('unexpected storage.list');
			}
		} as StoragePort;

		const useCase = new ExportDeviceLibraryBookUseCase(
			bookRepository,
			deviceDownloadRepository,
			deviceProgressDownloadRepository,
			storage,
			{
				async execute(): Promise<ReturnType<typeof apiOk<{ success: true; outcome: 'created' }>>> {
					return apiOk({ success: true, outcome: 'created' });
				}
			}
		);

		const result = await useCase.execute({
			deviceId: 'device-1',
			fileName: 'Book Title.epub',
			fileData: toArrayBuffer(Buffer.from('book-data')),
			sidecarData: toArrayBuffer(
				Buffer.from('return {\n  ["summary"] = { ["modified"] = "2026-03-25" },\n  ["percent_finished"] = 0.4\n}\n')
			)
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.deepEqual(result.value, {
			success: true,
			bookOutcome: 'created',
			sidecarOutcome: 'imported'
		});
		assert.deepEqual(updatedProgress, {
			bookId: 7,
			progressKey: 'Book_Title.sdr/metadata.epub.lua',
			progressPercent: 0.4,
			progressUpdatedAt: '2026-03-25T00:00:00.000Z'
		});
		assert.deepEqual(progressMarker, {
			deviceId: 'device-1',
			bookId: 7,
			progressUpdatedAt: '2026-03-25T00:00:00.000Z'
		});
		const uploadedSidecar = storedSidecar as StoredSidecar | null;
		assert.notEqual(uploadedSidecar, null);
		if (uploadedSidecar === null) {
			throw new Error('Expected sidecar upload');
		}
		assert.equal(uploadedSidecar.key, 'library/Book_Title.sdr/metadata.epub.lua');
		assert.equal(uploadedSidecar.contentType, 'application/x-lua');
	});

	test('returns an error when checking the existing sidecar fails for a non-missing reason', async () => {
		const existingBook = createBook({ id: 8 });

		const bookRepository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return existingBook;
			}
		} as unknown as BookRepositoryPort;

		const deviceDownloadRepository = {
			async ensureByDeviceAndBook(input: {
				deviceId: string;
				bookId: number;
			}): Promise<{ id: number; deviceId: string; bookId: number }> {
				return { id: 1, ...input };
			}
		} as unknown as DeviceDownloadRepositoryPort;

		const deviceProgressDownloadRepository = {
			async upsertByDeviceAndBook(): Promise<never> {
				throw new Error('unexpected progress marker write');
			}
		} as unknown as DeviceProgressDownloadRepositoryPort;

		const storage = {
			async exists(): Promise<boolean> {
				throw Object.assign(new Error('Access denied'), { name: 'AccessDenied' });
			},
			async put(): Promise<void> {
				throw new Error('unexpected storage.put');
			},
			async get(): Promise<Buffer> {
				throw new Error('unexpected storage.get');
			},
			async delete(): Promise<void> {
				throw new Error('unexpected storage.delete');
			},
			async list(): Promise<[]> {
				throw new Error('unexpected storage.list');
			}
		} as StoragePort;

		const useCase = new ExportDeviceLibraryBookUseCase(
			bookRepository,
			deviceDownloadRepository,
			deviceProgressDownloadRepository,
			storage,
			{
				async execute(): Promise<ReturnType<typeof apiOk<{ success: true; outcome: 'created' }>>> {
					throw new Error('unexpected importer call');
				}
			}
		);

		const result = await useCase.execute({
			deviceId: 'device-1',
			fileName: 'Book Title.epub',
			fileData: toArrayBuffer(Buffer.from('book-data')),
			sidecarData: toArrayBuffer(
				Buffer.from('return {\n  ["summary"] = { ["modified"] = "2026-03-25" },\n  ["percent_finished"] = 0.4\n}\n')
			)
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected failure');
		}
		assert.equal(result.error.status, 500);
		assert.equal(result.error.message, 'Failed to read existing progress sidecar');
	});

	test('treats active duplicates as successful reruns and still imports newer sidecars', async () => {
		let importerCalls = 0;
		let updatedProgressCalls = 0;
		const existingBook = createBook({
			id: 9,
			progress_percent: 0.2,
			progress_updated_at: '2026-03-20T00:00:00.000Z'
		});

		const bookRepository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return existingBook;
			},
			async updateProgress(): Promise<void> {
				updatedProgressCalls += 1;
			}
		} as unknown as BookRepositoryPort;

		const deviceDownloadRepository = {
			async ensureByDeviceAndBook(input: {
				deviceId: string;
				bookId: number;
			}): Promise<{ id: number; deviceId: string; bookId: number }> {
				return { id: 1, ...input };
			}
		} as unknown as DeviceDownloadRepositoryPort;

		const deviceProgressDownloadRepository = {
			async upsertByDeviceAndBook(input: {
				deviceId: string;
				bookId: number;
				progressUpdatedAt: string;
			}): Promise<{ id: number; deviceId: string; bookId: number; progressUpdatedAt: string }> {
				return { id: 1, ...input };
			}
		} as unknown as DeviceProgressDownloadRepositoryPort;

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				return Buffer.from('return { ["summary"] = { ["modified"] = "2026-03-20" } }');
			},
			async delete(): Promise<void> {
				throw new Error('unexpected storage.delete');
			},
			async list(): Promise<[]> {
				throw new Error('unexpected storage.list');
			}
		} as StoragePort;

		const useCase = new ExportDeviceLibraryBookUseCase(
			bookRepository,
			deviceDownloadRepository,
			deviceProgressDownloadRepository,
			storage,
			{
				async execute(): Promise<ReturnType<typeof apiOk<{ success: true; outcome: 'created' }>>> {
					importerCalls += 1;
					return apiOk({ success: true, outcome: 'created' });
				}
			}
		);

		const result = await useCase.execute({
			deviceId: 'device-1',
			fileName: 'Book Title.epub',
			fileData: toArrayBuffer(Buffer.from('book-data')),
			sidecarData: toArrayBuffer(
				Buffer.from('return {\n  ["summary"] = { ["modified"] = "2026-03-25" },\n  ["percent_finished"] = 0.8\n}\n')
			)
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.equal(importerCalls, 0);
		assert.equal(updatedProgressCalls, 1);
		assert.deepEqual(result.value, {
			success: true,
			bookOutcome: 'duplicate',
			sidecarOutcome: 'imported'
		});
	});

	test('skips incoming sidecars that are older than the server copy', async () => {
		let updatedProgressCalls = 0;
		let markerCalls = 0;
		let storedSidecarCalls = 0;
		const existingBook = createBook({
			id: 11,
			progress_percent: 0.6,
			progress_updated_at: '2026-03-21T00:00:00.000Z'
		});

		const bookRepository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return existingBook;
			},
			async updateProgress(): Promise<void> {
				updatedProgressCalls += 1;
			}
		} as unknown as BookRepositoryPort;

		const deviceDownloadRepository = {
			async ensureByDeviceAndBook(input: {
				deviceId: string;
				bookId: number;
			}): Promise<{ id: number; deviceId: string; bookId: number }> {
				return { id: 1, ...input };
			}
		} as unknown as DeviceDownloadRepositoryPort;

		const deviceProgressDownloadRepository = {
			async upsertByDeviceAndBook(): Promise<never> {
				markerCalls += 1;
				throw new Error('unexpected marker upsert');
			}
		} as unknown as DeviceProgressDownloadRepositoryPort;

		const storage = {
			async put(): Promise<void> {
				storedSidecarCalls += 1;
			},
			async get(): Promise<Buffer> {
				return Buffer.from('return { ["summary"] = { ["modified"] = "2026-03-21" } }');
			},
			async delete(): Promise<void> {
				throw new Error('unexpected storage.delete');
			},
			async list(): Promise<[]> {
				throw new Error('unexpected storage.list');
			}
		} as StoragePort;

		const useCase = new ExportDeviceLibraryBookUseCase(
			bookRepository,
			deviceDownloadRepository,
			deviceProgressDownloadRepository,
			storage,
			{
				async execute(): Promise<ReturnType<typeof apiOk<{ success: true; outcome: 'created' }>>> {
					throw new Error('unexpected importer call');
				}
			}
		);

		const result = await useCase.execute({
			deviceId: 'device-1',
			fileName: 'Book Title.epub',
			fileData: toArrayBuffer(Buffer.from('book-data')),
			sidecarData: toArrayBuffer(
				Buffer.from('return {\n  ["summary"] = { ["modified"] = "2026-03-20" },\n  ["percent_finished"] = 0.3\n}\n')
			)
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.deepEqual(result.value, {
			success: true,
			bookOutcome: 'duplicate',
			sidecarOutcome: 'skipped_older'
		});
		assert.equal(updatedProgressCalls, 0);
		assert.equal(storedSidecarCalls, 0);
		assert.equal(markerCalls, 0);
	});

	test('returns a conflict when only a trashed duplicate exists', async () => {
		const trashedBook = createBook({
			id: 13,
			title: 'Archived Book',
			deleted_at: '2026-03-24T12:00:00.000Z'
		});

		const bookRepository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return trashedBook;
			}
		} as unknown as BookRepositoryPort;

		const useCase = new ExportDeviceLibraryBookUseCase(
			bookRepository,
			{} as DeviceDownloadRepositoryPort,
			{} as DeviceProgressDownloadRepositoryPort,
			{} as StoragePort,
			{
				async execute(): Promise<ReturnType<typeof apiOk<{ success: true; outcome: 'created' }>>> {
					throw new Error('unexpected importer call');
				}
			}
		);

		const result = await useCase.execute({
			deviceId: 'device-1',
			fileName: 'Archived Book.epub',
			fileData: toArrayBuffer(Buffer.from('book-data'))
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected conflict');
		}
		assert.equal(result.error.status, 409);
		assert.match(result.error.message, /trashed book/i);
	});
});
