import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PutLibraryFileUseCase } from '$lib/server/application/use-cases/PutLibraryFileUseCase';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { CreateBookInput, Book } from '$lib/server/domain/entities/Book';
import type { ExternalBookMetadata } from '$lib/server/application/services/ExternalBookMetadataService';
import type {
	ExtractedEpubUploadData,
	ExtractedUploadMetadata
} from '$lib/server/application/services/EpubMetadataService';
import type { ManagedBookCoverResult } from '$lib/server/application/services/ManagedBookCoverService';

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
	return Uint8Array.from(buffer).buffer as ArrayBuffer;
}

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
			s3_storage_key: 'example.epub',
			title: 'Example',
			zLibId: null,
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
			year: null
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
		externalRatingCount: null
	};
}

function emptyManagedCoverResult(): ManagedBookCoverResult {
	return {
		managedUrl: null,
		sourceUrl: null
	};
}

function extractedUploadData(
	metadata: ExtractedUploadMetadata | null,
	cover: ExtractedEpubUploadData['cover'] = null
): ExtractedEpubUploadData {
	return {
		metadata,
		cover
	};
}

function noopManagedCoverService() {
	return {
		async storeFromSearchImport(): Promise<ManagedBookCoverResult> {
			return emptyManagedCoverResult();
		},
		async storeFromBuffer(): Promise<ManagedBookCoverResult> {
			return emptyManagedCoverResult();
		}
	};
}

describe('PutLibraryFileUseCase', () => {
	test('uses embedded EPUB metadata before filename-derived fallback and external lookup', async () => {
		let storedKey: string | null = null;
		let createdBook: CreateBookInput | null = null;
		let lookupInput:
			| {
					title: string;
					author: string | null;
					identifier: string | null;
					language?: string | null;
			  }
			| null = null;

		const storage = {
			async put(key: string): Promise<void> {
				storedKey = key;
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const epubMetadataService = {
			async extractUploadData(): Promise<ExtractedEpubUploadData> {
				return extractedUploadData({
					title: 'Embedded Title',
					author: 'Embedded Author',
					publisher: 'Embedded Publisher',
					identifier: null,
					description: null,
					language: 'en',
					year: 2024
				});
			}
		};

		const externalMetadataService = {
			async lookup(input: {
				title: string;
				author: string | null;
				identifier: string | null;
				language?: string | null;
			}): Promise<ExternalBookMetadata> {
				lookupInput = input;
				return {
					...emptyExternalMetadata(),
					publisher: 'External Publisher',
					identifier: '9781111111111',
					description: 'External description',
					openLibraryKey: 'OL123W'
				};
			}
		};

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			noopManagedCoverService(),
			epubMetadataService,
			externalMetadataService
		);

		const result = await useCase.execute('filename-fallback.epub', toArrayBuffer(Buffer.from('epub-data')));

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.outcome, 'created');
		assert.equal(storedKey, 'library/filename-fallback.epub');
		assert.deepEqual(lookupInput, {
			title: 'Embedded Title',
			author: 'Embedded Author',
			identifier: null,
			language: 'en'
		});
		assert.deepEqual(createdBook, {
			s3_storage_key: 'filename-fallback.epub',
			title: 'Embedded Title',
			zLibId: null,
			author: 'Embedded Author',
			publisher: 'Embedded Publisher',
			series: null,
			volume: null,
			series_index: null,
			edition: null,
			identifier: '9781111111111',
			pages: null,
			description: 'External description',
			google_books_id: null,
			open_library_key: 'OL123W',
			amazon_asin: null,
			external_rating: null,
			external_rating_count: null,
			cover: null,
			extension: 'epub',
			filesize: 9,
			language: 'en',
			year: 2024
		});
	});

	test('keeps non-EPUB uploads on the existing filename and external-lookup path', async () => {
		let extractorCalls = 0;
		let createdBook: CreateBookInput | null = null;

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const epubMetadataService = {
			async extractUploadData(): Promise<ExtractedEpubUploadData> {
				extractorCalls += 1;
				return extractedUploadData(null);
			}
		};

		const externalMetadataService = {
			async lookup(): Promise<ExternalBookMetadata> {
				return {
					...emptyExternalMetadata(),
					publisher: 'External Publisher',
					identifier: 'PDF-ID',
					description: 'External description'
				};
			}
		};

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			noopManagedCoverService(),
			epubMetadataService,
			externalMetadataService
		);

		const result = await useCase.execute('Manual Upload.pdf', toArrayBuffer(Buffer.from('pdf')));

		assert.equal(result.ok, true);
		assert.equal(extractorCalls, 0);
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}
		const created = createdBook as CreateBookInput;
		assert.equal(created.title, 'Manual Upload');
		assert.equal(created.author, null);
		assert.equal(created.publisher, 'External Publisher');
		assert.equal(created.identifier, 'PDF-ID');
		assert.equal(created.description, 'External description');
		assert.equal(created.language, null);
		assert.equal(created.year, null);
	});

	test('continues upload when EPUB extraction returns no metadata', async () => {
		let stored = false;
		let createdBook: CreateBookInput | null = null;

		const storage = {
			async put(): Promise<void> {
				stored = true;
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const epubMetadataService = {
			async extractUploadData(): Promise<ExtractedEpubUploadData> {
				return extractedUploadData(null);
			}
		};

		const externalMetadataService = {
			async lookup(): Promise<ExternalBookMetadata> {
				return {
					...emptyExternalMetadata(),
					publisher: 'Recovered Publisher'
				};
			}
		};

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			noopManagedCoverService(),
			epubMetadataService,
			externalMetadataService
		);

		const result = await useCase.execute('Fallback.epub', toArrayBuffer(Buffer.from('epub-data')));

		assert.equal(result.ok, true);
		assert.equal(stored, true);
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}
		const created = createdBook as CreateBookInput;
		assert.equal(created.title, 'Fallback');
		assert.equal(created.publisher, 'Recovered Publisher');
	});

	test('rejects duplicate uploads before extraction or storage', async () => {
		let extractorCalls = 0;
		let storageCalls = 0;

		const storage = {
			async put(): Promise<void> {
				storageCalls += 1;
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return createBookRecord({
					s3_storage_key: 'existing.epub',
					title: 'Existing',
					zLibId: null,
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
					year: null
				});
			}
		} as unknown as BookRepositoryPort;

		const epubMetadataService = {
			async extractUploadData(): Promise<ExtractedEpubUploadData> {
				extractorCalls += 1;
				return extractedUploadData(null);
			}
		};

		const externalMetadataService = {
			async lookup(): Promise<ExternalBookMetadata> {
				throw new Error('lookup should not be called');
			}
		};

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			noopManagedCoverService(),
			epubMetadataService,
			externalMetadataService
		);

		const result = await useCase.execute('existing.epub', toArrayBuffer(Buffer.from('epub-data')));

		assert.equal(result.ok, false);
		assert.equal(result.error.status, 409);
		assert.equal(extractorCalls, 0);
		assert.equal(storageCalls, 0);
	});

	test('rejects uploads when a same-name book is already in trash', async () => {
		let extractorCalls = 0;
		let storageCalls = 0;

		const storage = {
			async put(): Promise<void> {
				storageCalls += 1;
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return createBook({
					id: 7,
					s3_storage_key: 'bookA.epub',
					title: 'bookA',
					deleted_at: '2026-03-19T00:00:00.000Z',
					trash_expires_at: '2026-04-18T00:00:00.000Z'
				});
			}
		} as unknown as BookRepositoryPort;

		const epubMetadataService = {
			async extractUploadData(): Promise<ExtractedEpubUploadData> {
				extractorCalls += 1;
				return extractedUploadData(null);
			}
		};

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			noopManagedCoverService(),
			epubMetadataService,
			{
				async lookup(): Promise<ExternalBookMetadata> {
					throw new Error('lookup should not be called');
				}
			}
		);

		const result = await useCase.execute('bookA.epub', toArrayBuffer(Buffer.from('epub-data')));

		assert.equal(result.ok, false);
		assert.equal(result.error.status, 409);
		assert.match(result.error.message, /trashed book with this file name/i);
		assert.equal(extractorCalls, 0);
		assert.equal(storageCalls, 0);
	});

	test('prefers managed internal covers for provider-import uploads and falls back to source cover when needed', async () => {
		let createdBook: CreateBookInput | null = null;
		let managedCoverInput:
			| {
					bookStorageKey: string;
					provider: string;
					coverUrl: string | null | undefined;
			  }
			| null = null;

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			{
				async storeFromSearchImport(input): Promise<ManagedBookCoverResult> {
					managedCoverInput = input;
					return {
						managedUrl: '/api/library/covers/provider-book.epub.jpg',
						sourceUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
					};
				},
				async storeFromBuffer(): Promise<ManagedBookCoverResult> {
					return emptyManagedCoverResult();
				}
			},
			{
				async extractUploadData(): Promise<ExtractedEpubUploadData> {
					return extractedUploadData(null);
				}
			},
			{
				async lookup(): Promise<ExternalBookMetadata> {
					return {
						...emptyExternalMetadata(),
						cover: 'https://external.example/cover.jpg'
					};
				}
			}
		);

		const result = await useCase.execute('provider-book.epub', toArrayBuffer(Buffer.from('epub-data')), {
			provider: 'openlibrary',
			coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});

		assert.equal(result.ok, true);
		assert.deepEqual(managedCoverInput, {
			bookStorageKey: 'provider-book.epub',
			provider: 'openlibrary',
			coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}
		const created = createdBook as CreateBookInput;
		assert.equal(created.cover, '/api/library/covers/provider-book.epub.jpg');
	});

	test('falls back to the source cover URL when managed cover storage fails during provider import', async () => {
		let createdBook: CreateBookInput | null = null;

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			{
				async storeFromSearchImport(): Promise<ManagedBookCoverResult> {
					return {
						managedUrl: null,
						sourceUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
					};
				},
				async storeFromBuffer(): Promise<ManagedBookCoverResult> {
					return emptyManagedCoverResult();
				}
			},
			{
				async extractUploadData(): Promise<ExtractedEpubUploadData> {
					return extractedUploadData(null);
				}
			},
			{
				async lookup(): Promise<ExternalBookMetadata> {
					return {
						...emptyExternalMetadata(),
						cover: 'https://external.example/cover.jpg'
					};
				}
			}
		);

		const result = await useCase.execute('provider-book.epub', toArrayBuffer(Buffer.from('epub-data')), {
			provider: 'openlibrary',
			coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});

		assert.equal(result.ok, true);
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}
		const created = createdBook as CreateBookInput;
		assert.equal(created.cover, 'https://covers.openlibrary.org/b/id/123-L.jpg');
	});

	test('stores an embedded EPUB cover internally and prefers it over provider and external covers', async () => {
		let createdBook: CreateBookInput | null = null;
		let bufferCoverInput:
			| {
					bookStorageKey: string;
					coverBuffer: Buffer;
					contentType: string;
			  }
			| null = null;
		let sourceCoverCalls = 0;

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const coverBuffer = Buffer.from([1, 2, 3, 4]);
		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			{
				async storeFromSearchImport(): Promise<ManagedBookCoverResult> {
					sourceCoverCalls += 1;
					return {
						managedUrl: '/api/library/covers/from-source.epub.jpg',
						sourceUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
					};
				},
				async storeFromBuffer(input): Promise<ManagedBookCoverResult> {
					bufferCoverInput = input;
					return {
						managedUrl: '/api/library/covers/embedded-book.epub.png',
						sourceUrl: null
					};
				}
			},
			{
				async extractUploadData(): Promise<ExtractedEpubUploadData> {
					return extractedUploadData(
						{
							title: 'Embedded Book',
							author: null,
							publisher: null,
							identifier: null,
							description: null,
							language: null,
							year: null
						},
						{
							data: coverBuffer,
							contentType: 'image/png'
						}
					);
				}
			},
			{
				async lookup(): Promise<ExternalBookMetadata> {
					return {
						...emptyExternalMetadata(),
						cover: 'https://external.example/cover.jpg'
					};
				}
			}
		);

		const result = await useCase.execute('embedded-book.epub', toArrayBuffer(Buffer.from('epub-data')), {
			provider: 'openlibrary',
			coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});

		assert.equal(result.ok, true);
		assert.deepEqual(bufferCoverInput, {
			bookStorageKey: 'embedded-book.epub',
			coverBuffer,
			contentType: 'image/png'
		});
		assert.equal(sourceCoverCalls, 0);
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}
		const created = createdBook as CreateBookInput;
		assert.equal(created.cover, '/api/library/covers/embedded-book.epub.png');
	});

	test('preserves an explicit null seriesIndex from source imports instead of falling back', async () => {
		let createdBook: CreateBookInput | null = null;

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {
				throw new Error('not implemented');
			},
			async list(): Promise<[]> {
				throw new Error('not implemented');
			}
		} as StoragePort;

		const repository = {
			async getByStorageKeyIncludingTrashed(): Promise<Book | undefined> {
				return undefined;
			},
			async create(book: CreateBookInput): Promise<Book> {
				createdBook = book;
				return createBookRecord(book);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new PutLibraryFileUseCase(
			storage,
			repository,
			noopManagedCoverService(),
			{
				async extractUploadData(): Promise<ExtractedEpubUploadData> {
					return extractedUploadData(null);
				}
			},
			{
				async lookup(): Promise<ExternalBookMetadata> {
					return {
						...emptyExternalMetadata(),
						volume: '9',
						seriesIndex: 9
					};
				}
			}
		);

		const result = await useCase.execute('provider-book.epub', toArrayBuffer(Buffer.from('epub-data')), {
			provider: 'openlibrary',
			coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg',
			volume: '4',
			seriesIndex: null
		});

		assert.equal(result.ok, true);
		if (createdBook === null) {
			throw new Error('Expected a created book record');
		}

		const created = createdBook as CreateBookInput;
		assert.equal(created.series_index, null);
	});
});
