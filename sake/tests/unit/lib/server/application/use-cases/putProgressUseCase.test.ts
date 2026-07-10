import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BookProgressHistoryRepositoryPort } from '$lib/server/application/ports/BookProgressHistoryRepositoryPort';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { DeviceProgressDownloadRepositoryPort } from '$lib/server/application/ports/DeviceProgressDownloadRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { PutProgressUseCase } from '$lib/server/application/use-cases/PutProgressUseCase';
import type { Book, CreateBookInput } from '$lib/server/domain/entities/Book';
import type { BookProgressHistory } from '$lib/server/domain/entities/BookProgressHistory';

function createBook(): Book {
	const input: CreateBookInput = {
		s3_storage_key: 'Example.epub',
		title: 'Example',
		zLibId: null,
		author: null,
		publisher: null,
		series: null,
		volume: null,
		series_index: null,
		edition: null,
		identifier: null,
		pages: 100,
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
		day: null
	};

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
		trash_expires_at: null
	};
}

function toArrayBuffer(value: string): ArrayBuffer {
	return Uint8Array.from(Buffer.from(value)).buffer as ArrayBuffer;
}

describe('PutProgressUseCase', () => {
	test('updates one progress history snapshot per web reader session', async () => {
		const book = createBook();
		const readerSnapshots = new Map<string, BookProgressHistory>();
		const appendedSnapshots: BookProgressHistory[] = [];
		let nextHistoryId = 1;

		const bookRepository = {
			async getByStorageKey(storageKey: string): Promise<Book | undefined> {
				return storageKey === book.s3_storage_key ? book : undefined;
			},
			async updateProgress(
				bookId: number,
				progressKey: string,
				progressPercent: number | null
			): Promise<void> {
				assert.equal(bookId, book.id);
				book.progress_storage_key = progressKey;
				book.progress_percent = progressPercent;
				book.progress_updated_at = new Date().toISOString();
			}
		} as unknown as BookRepositoryPort;

		const progressHistoryRepository: BookProgressHistoryRepositoryPort = {
			async appendSnapshot(input): Promise<BookProgressHistory> {
				const snapshot: BookProgressHistory = {
					id: nextHistoryId++,
					bookId: input.bookId,
					progressPercent: input.progressPercent,
					recordedAt: new Date().toISOString(),
					readerSessionId: null
				};
				appendedSnapshots.push(snapshot);
				return snapshot;
			},
			async upsertReaderSessionSnapshot(input): Promise<BookProgressHistory> {
				const existing = readerSnapshots.get(input.readerSessionId);
				const snapshot: BookProgressHistory = {
					id: existing?.id ?? nextHistoryId++,
					bookId: input.bookId,
					progressPercent: input.progressPercent,
					recordedAt: new Date().toISOString(),
					readerSessionId: input.readerSessionId
				};
				readerSnapshots.set(input.readerSessionId, snapshot);
				return snapshot;
			},
			async getByBookId(): Promise<BookProgressHistory[]> {
				return [];
			}
		};

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				return Buffer.alloc(0);
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} satisfies StoragePort;

		const deviceProgressDownloadRepository = {
			async upsertByDeviceAndBook(): Promise<never> {
				throw new Error('unexpected device progress write');
			},
			async deleteByDeviceId(): Promise<void> {}
		} satisfies DeviceProgressDownloadRepositoryPort;

		const useCase = new PutProgressUseCase(
			bookRepository,
			progressHistoryRepository,
			storage,
			deviceProgressDownloadRepository
		);

		for (const [readerSessionId, percentFinished] of [
			['48d2f83f-7568-4f58-8c48-1e773c0d7b58', 0.1],
			['48d2f83f-7568-4f58-8c48-1e773c0d7b58', 0.2],
			['a6bf3e4c-95ce-4bf8-bd6f-5faf3319bd8f', 0.25]
		] as const) {
			const result = await useCase.execute({
				fileName: 'Example.epub',
				fileData: toArrayBuffer('sidecar'),
				percentFinished,
				readerSessionId
			});
			assert.equal(result.ok, true);
		}

		assert.equal(readerSnapshots.size, 2);
		assert.equal(readerSnapshots.get('48d2f83f-7568-4f58-8c48-1e773c0d7b58')?.progressPercent, 0.2);
		assert.equal(appendedSnapshots.length, 0);

		const externalResult = await useCase.execute({
			fileName: 'Example.epub',
			fileData: toArrayBuffer('sidecar'),
			percentFinished: 0.3
		});
		assert.equal(externalResult.ok, true);
		assert.equal(appendedSnapshots.length, 1);
	});
});
