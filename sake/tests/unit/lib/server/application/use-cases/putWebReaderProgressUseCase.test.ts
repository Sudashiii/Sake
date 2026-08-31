import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BookProgressHistoryRepositoryPort } from '$lib/server/application/ports/BookProgressHistoryRepositoryPort';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { DeviceProgressDownloadRepositoryPort } from '$lib/server/application/ports/DeviceProgressDownloadRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { ProgressBookResolver } from '$lib/server/application/services/ProgressBookResolver';
import { ProgressPersistenceService } from '$lib/server/application/services/ProgressPersistenceService';
import { SidecarWriteCoordinator } from '$lib/server/application/services/SidecarWriteCoordinator';
import { PutWebReaderProgressUseCase } from '$lib/server/application/use-cases/PutWebReaderProgressUseCase';
import { parseKoreaderSidecar, type ReaderAnnotation } from '$lib/koreader/koreaderSidecar';
import type { Book, CreateBookInput } from '$lib/server/domain/entities/Book';
import type { BookProgressHistory } from '$lib/server/domain/entities/BookProgressHistory';
import type { DeviceProgressDownload } from '$lib/server/domain/entities/DeviceProgressDownload';

const PROGRESS_KEY = 'library/Example.sdr/metadata.epub.lua';

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
		progress_percent: 0.1,
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

const INITIAL_SOURCE = `return {
    ["annotations"] = {},
    ["cre_dom_version"] = 20240114,
    ["last_xpointer"] = "/body/DocFragment/body/p/text().1",
    ["percent_finished"] = 0.1,
    ["summary"] = {
        ["modified"] = "2026-08-30",
        ["percent_finished"] = 0.1,
        ["status"] = "reading",
    },
    ["unknown_plugin_setting"] = "keep me",
}
`;

function createAnnotation(): ReaderAnnotation {
	return {
		id: 'web-annotation',
		kind: 'highlight',
		page: '/body/DocFragment/body/p/text().1',
		pos0: '/body/DocFragment/body/p/text().1',
		pos1: '/body/DocFragment/body/p/text().5',
		text: 'Hello',
		datetime: '2026-08-31 10:00:00',
		datetimeUpdated: '2026-08-31 10:00:00',
		drawer: 'lighten',
		color: 'yellow'
	};
}

interface Harness {
	book: Book;
	objects: Map<string, Buffer>;
	bookRepository: BookRepositoryPort;
	useCase: PutWebReaderProgressUseCase;
}

function createHarness(
	initialSource: string | null = INITIAL_SOURCE,
	beforePut?: (call: number) => Promise<void>
): Harness {
	const book = createBook();
	const objects = new Map<string, Buffer>();
	if (initialSource !== null) objects.set(PROGRESS_KEY, Buffer.from(initialSource));
	let putCalls = 0;

	const bookRepository = {
		async getByStorageKey(storageKey: string): Promise<Book | undefined> {
			return storageKey === book.s3_storage_key ? book : undefined;
		},
		async getById(bookId: number): Promise<Book | undefined> {
			return bookId === book.id ? book : undefined;
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

	const storage: StoragePort = {
		async put(key, body): Promise<void> {
			putCalls += 1;
			await beforePut?.(putCalls);
			objects.set(key, Buffer.from(body as Buffer));
		},
		async get(key): Promise<Buffer> {
			const value = objects.get(key);
			if (!value) throw new Error(`Missing object: ${key}`);
			return Buffer.from(value);
		},
		async exists(key): Promise<boolean> {
			return objects.has(key);
		},
		async delete(key): Promise<void> {
			objects.delete(key);
		},
		async list(): Promise<[]> {
			return [];
		}
	};

	const historyRepository: BookProgressHistoryRepositoryPort = {
		async appendSnapshot(input): Promise<BookProgressHistory> {
			return {
				id: 1,
				bookId: input.bookId,
				progressPercent: input.progressPercent,
				recordedAt: new Date().toISOString(),
				readerSessionId: null
			};
		},
		async upsertReaderSessionSnapshot(input): Promise<BookProgressHistory> {
			return {
				id: 1,
				bookId: input.bookId,
				progressPercent: input.progressPercent,
				recordedAt: new Date().toISOString(),
				readerSessionId: input.readerSessionId
			};
		},
		async getByBookId(): Promise<BookProgressHistory[]> {
			return [];
		}
	};

	const deviceRepository: DeviceProgressDownloadRepositoryPort = {
		async upsertByDeviceAndBook(input): Promise<DeviceProgressDownload> {
			return { id: 1, ...input };
		},
		async deleteByDeviceId(): Promise<void> {}
	};

	const persistenceService = new ProgressPersistenceService(
		bookRepository,
		historyRepository,
		storage,
		deviceRepository
	);
	const useCase = new PutWebReaderProgressUseCase(
		new ProgressBookResolver(bookRepository),
		storage,
		persistenceService,
		new SidecarWriteCoordinator()
	);
	return { book, objects, bookRepository, useCase };
}

describe('PutWebReaderProgressUseCase', () => {
	test('merges position-less annotation changes without replacing the saved position', async () => {
		const harness = createHarness();
		const result = await harness.useCase.execute({
			fileName: 'Example.epub',
			readerSessionId: '48d2f83f-7568-4f58-8c48-1e773c0d7b58',
			changes: {
				upsertedAnnotations: [createAnnotation()],
				deletedAnnotationIds: []
			}
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		const stored = parseKoreaderSidecar(harness.objects.get(PROGRESS_KEY)!.toString('utf8'));
		assert.equal(stored.percentFinished, 0.1);
		assert.equal(stored.lastXPointer, '/body/DocFragment/body/p/text().1');
		assert.equal(stored.annotations.length, 1);
		assert.match(result.value.sidecar.source, /unknown_plugin_setting/);
	});

	test('rejects a malformed existing sidecar without overwriting it', async () => {
		const harness = createHarness('return { ["broken"] = os.execute("nope") }');
		const result = await harness.useCase.execute({
			fileName: 'Example.epub',
			readerSessionId: '48d2f83f-7568-4f58-8c48-1e773c0d7b58',
			changes: {
				percentFinished: 0.5,
				lastXPointer: '/body/DocFragment/body/p/text().5',
				upsertedAnnotations: [],
				deletedAnnotationIds: []
			}
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 409);
		assert.equal(harness.objects.get(PROGRESS_KEY)!.toString('utf8'), 'return { ["broken"] = os.execute("nope") }');
	});

	test('creates a valid sidecar when no progress exists yet', async () => {
		const harness = createHarness(null);
		const result = await harness.useCase.execute({
			fileName: 'Example.epub',
			readerSessionId: '48d2f83f-7568-4f58-8c48-1e773c0d7b58',
			changes: {
				percentFinished: 0.5,
				lastXPointer: '/body/DocFragment/body/p/text().5',
				upsertedAnnotations: [],
				deletedAnnotationIds: []
			}
		});

		assert.equal(result.ok, true);
		assert.equal(parseKoreaderSidecar(harness.objects.get(PROGRESS_KEY)!.toString('utf8')).percentFinished, 0.5);
	});

	test('serializes overlapping web writes and merges the latest stored source', async () => {
		let markFirstPutStarted: (() => void) | undefined;
		const firstPutStarted = new Promise<void>((resolve) => {
			markFirstPutStarted = resolve;
		});
		let releaseFirstPut: (() => void) | undefined;
		const firstPutGate = new Promise<void>((resolve) => {
			releaseFirstPut = resolve;
		});
		const harness = createHarness(INITIAL_SOURCE, async (call) => {
			if (call === 1) {
				markFirstPutStarted?.();
				await firstPutGate;
			}
		});

		const first = harness.useCase.execute({
			fileName: 'Example.epub',
			readerSessionId: '48d2f83f-7568-4f58-8c48-1e773c0d7b58',
			changes: {
				percentFinished: 0.2,
				lastXPointer: '/body/DocFragment/body/p/text().2',
				upsertedAnnotations: [],
				deletedAnnotationIds: []
			}
		});
		await firstPutStarted;

		const second = harness.useCase.execute({
			fileName: 'Example.epub',
			readerSessionId: 'a6bf3e4c-95ce-4bf8-bd6f-5faf3319bd8f',
			changes: {
				percentFinished: 0.3,
				lastXPointer: '/body/DocFragment/body/p/text().3',
				upsertedAnnotations: [createAnnotation()],
				deletedAnnotationIds: []
			}
		});
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		releaseFirstPut?.();
		const results = await Promise.all([first, second]);

		assert.equal(results.every((result) => result.ok), true);
		const stored = parseKoreaderSidecar(harness.objects.get(PROGRESS_KEY)!.toString('utf8'));
		assert.equal(stored.percentFinished, 0.3);
		assert.equal(stored.lastXPointer, '/body/DocFragment/body/p/text().3');
		assert.equal(stored.annotations.length, 1);
		assert.match(harness.objects.get(PROGRESS_KEY)!.toString('utf8'), /unknown_plugin_setting/);
	});
});
