import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DownloadBookUseCase } from '$lib/server/application/use-cases/DownloadBookUseCase';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { CreateBookInput, Book } from '$lib/server/domain/entities/Book';
import { apiOk } from '$lib/server/http/api';
import type {
	ExternalBookMetadata,
	ExternalBookMetadataService
} from '$lib/server/application/services/ExternalBookMetadataService';

function createBookRecord(input: CreateBookInput): Book {
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

function createBook(overrides: Partial<Book>): Book {
	return {
		...createBookRecord({
			s3_storage_key: 'Example_Book_123.pdf',
			title: 'Example Book',
			zLibId: '123',
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
			extension: 'pdf',
			filesize: 8,
			language: null,
			year: null,
			month: null,
			day: null
		}),
		...overrides
	};
}

function emptyExternalMetadata(): ExternalBookMetadata {
	return {
		googleBooksId: null,
		openLibraryKey: null,
		amazonAsin: null,
		cover: null,
		description: null,
		publisher: null,
		series: null,
		volume: null,
		seriesIndex: null,
		edition: null,
		identifier: null,
		pages: null,
		externalRating: null,
		externalRatingCount: null,
		year: null,
		month: null,
		day: null
	};
}

describe('DownloadBookUseCase', () => {
	test('stores managed internal covers for new Z-Library imports', async () => {
		let uploadedKey: string | null = null;
		let createdBook: CreateBookInput | null = null;
		let managedCoverInput:
			| {
					bookStorageKey: string;
					provider: string;
					coverUrl: string | null | undefined;
					zlibraryCredentials?: { userId: string; userKey: string };
			  }
			| null = null;

		const zlibrary = {
			async tokenLogin(): Promise<ReturnType<typeof apiOk<void>>> {
				return apiOk(undefined);
			},
			async download(): Promise<ReturnType<typeof apiOk<Response>>> {
				return apiOk(
					new Response(Buffer.from('pdf-data'), {
						status: 200,
						headers: { 'content-type': 'application/pdf' }
					})
				);
			}
		};

		const repository = {
			async getByZLibIdIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const externalMetadataService = {
			async lookup(): Promise<ExternalBookMetadata> {
				return {
					...emptyExternalMetadata(),
					cover: 'https://external.example/cover.jpg'
				};
			}
		} as unknown as ExternalBookMetadataService;

		const useCase = new DownloadBookUseCase(
			zlibrary as never,
			repository,
			{
				async exists(): Promise<boolean> {
					return false;
				}
			},
			() => ({
				async upload(fileName: string): Promise<void> {
					uploadedKey = fileName;
				}
			}),
			{
				async storeFromSearchImport(input) {
					managedCoverInput = input;
					return {
						managedUrl: '/api/library/covers/Example_Book_123.pdf.jpg',
						sourceUrl: 'https://1lib.sk/covers/123.jpg'
					};
				}
			},
			undefined,
			externalMetadataService
		);

		const result = await useCase.execute({
			request: {
				bookId: '123',
				hash: 'abc',
				title: 'Example Book',
				upload: true,
				extension: 'pdf',
				cover: '/covers/123.jpg',
				downloadToDevice: false
			},
			credentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.outcome, 'created');
		assert.equal(uploadedKey, 'Example_Book_123.pdf');
		assert.deepEqual(managedCoverInput, {
			bookStorageKey: 'Example_Book_123.pdf',
			provider: 'zlibrary',
			coverUrl: '/covers/123.jpg',
			zlibraryCredentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}
		const created = createdBook as CreateBookInput;
		assert.equal(created.cover, '/api/library/covers/Example_Book_123.pdf.jpg');
	});

	test('falls back to the normalized source cover URL when managed cover storage fails', async () => {
		let createdBook: CreateBookInput | null = null;

		const zlibrary = {
			async tokenLogin(): Promise<ReturnType<typeof apiOk<void>>> {
				return apiOk(undefined);
			},
			async download(): Promise<ReturnType<typeof apiOk<Response>>> {
				return apiOk(
					new Response(Buffer.from('pdf-data'), {
						status: 200,
						headers: { 'content-type': 'application/pdf' }
					})
				);
			}
		};

		const repository = {
			async getByZLibIdIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const externalMetadataService = {
			async lookup(): Promise<ExternalBookMetadata> {
				return {
					...emptyExternalMetadata(),
					cover: 'https://external.example/cover.jpg'
				};
			}
		} as unknown as ExternalBookMetadataService;

		const useCase = new DownloadBookUseCase(
			zlibrary as never,
			repository,
			{
				async exists(): Promise<boolean> {
					return false;
				}
			},
			() => ({
				async upload(): Promise<void> {}
			}),
			{
				async storeFromSearchImport() {
					return {
						managedUrl: null,
						sourceUrl: 'https://1lib.sk/covers/123.jpg'
					};
				}
			},
			undefined,
			externalMetadataService
		);

		const result = await useCase.execute({
			request: {
				bookId: '123',
				hash: 'abc',
				title: 'Example Book',
				upload: true,
				extension: 'pdf',
				cover: '/covers/123.jpg',
				downloadToDevice: false
			},
			credentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.outcome, 'created');
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}
		const created = createdBook as CreateBookInput;
		assert.equal(created.cover, 'https://1lib.sk/covers/123.jpg');
	});

	test('treats an active same-zLibId import as a duplicate without creating a second row', async () => {
		let downloadCalls = 0;
		let createCalls = 0;
		let uploadCalls = 0;

		const zlibrary = {
			async tokenLogin(): Promise<ReturnType<typeof apiOk<void>>> {
				return apiOk(undefined);
			},
			async download(): Promise<ReturnType<typeof apiOk<Response>>> {
				downloadCalls += 1;
				return apiOk(new Response(Buffer.from('pdf-data')));
			}
		};

		const repository = {
			async getByZLibIdIncludingTrashed(): Promise<Book | undefined> {
				return createBook({ id: 42, deleted_at: null });
			},
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(): Promise<Book> {
				createCalls += 1;
				throw new Error('create should not be called');
			}
		} as unknown as BookRepositoryPort;

		const useCase = new DownloadBookUseCase(
			zlibrary as never,
			repository,
			{
				async exists(): Promise<boolean> {
					return true;
				}
			},
			() => ({
				async upload(): Promise<void> {
					uploadCalls += 1;
				}
			}),
			{
				async storeFromSearchImport() {
					throw new Error('managed cover storage should not be called');
				}
			}
		);

		const result = await useCase.execute({
			request: {
				bookId: '123',
				hash: 'abc',
				title: 'Example Book',
				upload: true,
				extension: 'pdf',
				downloadToDevice: false
			},
			credentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.outcome, 'duplicate');
		assert.equal(downloadCalls, 0);
		assert.equal(createCalls, 0);
		assert.equal(uploadCalls, 0);
	});

	test('restores a trashed same-zLibId import instead of creating a new row', async () => {
		let restoreBookId: number | null = null;
		let downloadCalls = 0;

		const zlibrary = {
			async tokenLogin(): Promise<ReturnType<typeof apiOk<void>>> {
				return apiOk(undefined);
			},
			async download(): Promise<ReturnType<typeof apiOk<Response>>> {
				downloadCalls += 1;
				return apiOk(new Response(Buffer.from('pdf-data')));
			}
		};

		const repository = {
			async getByZLibIdIncludingTrashed(): Promise<Book | undefined> {
				return createBook({
					id: 9,
					deleted_at: '2026-03-19T00:00:00.000Z',
					trash_expires_at: '2026-04-18T00:00:00.000Z'
				});
			},
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async restoreFromTrash(bookId: number): Promise<void> {
				restoreBookId = bookId;
			},
			async create(): Promise<Book> {
				throw new Error('create should not be called');
			}
		} as unknown as BookRepositoryPort;

		const useCase = new DownloadBookUseCase(
			zlibrary as never,
			repository,
			{
				async exists(): Promise<boolean> {
					return true;
				}
			},
			() => ({
				async upload(): Promise<void> {
					throw new Error('upload should not be called');
				}
			}),
			{
				async storeFromSearchImport() {
					throw new Error('managed cover storage should not be called');
				}
			}
		);

		const result = await useCase.execute({
			request: {
				bookId: '123',
				hash: 'abc',
				title: 'Example Book',
				upload: true,
				extension: 'pdf',
				downloadToDevice: false
			},
			credentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.outcome, 'restored');
		assert.equal(downloadCalls, 0);
		assert.equal(restoreBookId, 9);
	});

	test('repairs an existing same-zLibId book when the stored object is missing', async () => {
		let uploadedKey: string | null = null;
		let createCalls = 0;

		const zlibrary = {
			async tokenLogin(): Promise<ReturnType<typeof apiOk<void>>> {
				return apiOk(undefined);
			},
			async download(): Promise<ReturnType<typeof apiOk<Response>>> {
				return apiOk(
					new Response(Buffer.from('pdf-data'), {
						status: 200,
						headers: { 'content-type': 'application/pdf' }
					})
				);
			}
		};

		const repository = {
			async getByZLibIdIncludingTrashed(): Promise<Book | undefined> {
				return createBook({
					id: 3,
					s3_storage_key: 'Old_Title_123.pdf'
				});
			},
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(): Promise<Book> {
				createCalls += 1;
				throw new Error('create should not be called');
			}
		} as unknown as BookRepositoryPort;

		const useCase = new DownloadBookUseCase(
			zlibrary as never,
			repository,
			{
				async exists(): Promise<boolean> {
					return false;
				}
			},
			() => ({
				async upload(fileName: string): Promise<void> {
					uploadedKey = fileName;
				}
			}),
			{
				async storeFromSearchImport() {
					throw new Error('managed cover storage should not be called');
				}
			}
		);

		const result = await useCase.execute({
			request: {
				bookId: '123',
				hash: 'abc',
				title: 'Example Book',
				upload: true,
				extension: 'pdf',
				downloadToDevice: false
			},
			credentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.outcome, 'repaired');
		assert.equal(uploadedKey, 'Old_Title_123.pdf');
		assert.equal(createCalls, 0);
	});

	test('propagates storage existence errors instead of treating them as missing files', async () => {
		const zlibrary = {
			async tokenLogin(): Promise<ReturnType<typeof apiOk<void>>> {
				return apiOk(undefined);
			},
			async download(): Promise<ReturnType<typeof apiOk<Response>>> {
				throw new Error('download should not be called');
			}
		};

		const repository = {
			async getByZLibIdIncludingTrashed(): Promise<Book | undefined> {
				return createBook({ id: 11, deleted_at: null });
			},
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			}
		} as unknown as BookRepositoryPort;

		const useCase = new DownloadBookUseCase(
			zlibrary as never,
			repository,
			{
				async exists(): Promise<boolean> {
					throw new Error('access denied');
				}
			},
			() => ({
				async upload(): Promise<void> {
					throw new Error('upload should not be called');
				}
			}),
			{
				async storeFromSearchImport() {
					throw new Error('managed cover storage should not be called');
				}
			}
		);

		await assert.rejects(
			useCase.execute({
				request: {
					bookId: '123',
					hash: 'abc',
					title: 'Example Book',
					upload: true,
					extension: 'pdf',
					downloadToDevice: false
				},
				credentials: {
					userId: 'user-1',
					userKey: 'key-1'
				}
			}),
			/access denied/
		);
	});

	test('preserves an explicit null seriesIndex instead of falling back to parsed volume metadata', async () => {
		let createdBook: CreateBookInput | null = null;

		const zlibrary = {
			async tokenLogin(): Promise<ReturnType<typeof apiOk<void>>> {
				return apiOk(undefined);
			},
			async download(): Promise<ReturnType<typeof apiOk<Response>>> {
				return apiOk(
					new Response(Buffer.from('pdf-data'), {
						status: 200,
						headers: { 'content-type': 'application/pdf' }
					})
				);
			}
		};

		const repository = {
			async getByZLibIdIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const externalMetadataService = {
			async lookup(): Promise<ExternalBookMetadata> {
				return {
					...emptyExternalMetadata(),
					volume: '9',
					seriesIndex: 9
				};
			}
		} as unknown as ExternalBookMetadataService;

		const useCase = new DownloadBookUseCase(
			zlibrary as never,
			repository,
			{
				async exists(): Promise<boolean> {
					return false;
				}
			},
			() => ({
				async upload(): Promise<void> {}
			}),
			{
				async storeFromSearchImport() {
					return {
						managedUrl: null,
						sourceUrl: null
					};
				}
			},
			undefined,
			externalMetadataService
		);

		const result = await useCase.execute({
			request: {
				bookId: '123',
				hash: 'abc',
				title: 'Example Book',
				upload: true,
				extension: 'pdf',
				volume: '4',
				seriesIndex: null,
				downloadToDevice: false
			},
			credentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.equal(result.ok, true);
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}

		const created = createdBook as CreateBookInput;
		assert.equal(created.series_index, null);
	});
});
