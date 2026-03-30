import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GetLibraryBookDetailUseCase } from '$lib/server/application/use-cases/GetLibraryBookDetailUseCase';
import { RefetchLibraryBookMetadataUseCase } from '$lib/server/application/use-cases/RefetchLibraryBookMetadataUseCase';
import { UpdateLibraryBookMetadataUseCase } from '$lib/server/application/use-cases/UpdateLibraryBookMetadataUseCase';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { Book, UpdateBookMetadataInput } from '$lib/server/domain/entities/Book';
import type {
	ExternalBookMetadata,
	ExternalBookMetadataService
} from '$lib/server/application/services/ExternalBookMetadataService';
import { parseLibraryMetadataUpdateInput } from '$lib/server/http/libraryMetadataUpdate';
import { validatePublicationDateParts } from '$lib/utils/publicationDate';

function createBook(overrides: Partial<Book> = {}): Book {
	return {
		id: 1,
		zLibId: null,
		s3_storage_key: 'example.epub',
		title: 'Example',
		author: 'Jane Doe',
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
		createdAt: '2026-03-01T10:00:00.000Z',
		deleted_at: null,
		trash_expires_at: null,
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

describe('Library publication date metadata', () => {
	test('parseMetadataUpdateInput accepts valid full dates and rejects invalid ranges or calendar dates', () => {
		const parsed = parseLibraryMetadataUpdateInput({ year: 2024, month: 2, day: 29 });
		assert.equal(parsed.year, 2024);
		assert.equal(parsed.month, 2);
		assert.equal(parsed.day, 29);

		assert.throws(
			() => parseLibraryMetadataUpdateInput({ month: 13 }),
			/month must be at most 12/
		);
		assert.throws(
			() => parseLibraryMetadataUpdateInput({ day: 0 }),
			/day must be at least 1/
		);
		assert.throws(
			() => parseLibraryMetadataUpdateInput({ year: 2024, month: 2, day: 30 }),
			/published date is not a valid calendar date/
		);
	});

	test('validatePublicationDateParts accepts full dates for years below 100', () => {
		assert.equal(validatePublicationDateParts({ year: 98, month: 1, day: 1 }), null);
		assert.equal(validatePublicationDateParts({ year: 99, month: 2, day: 29 }), 'published date is not a valid calendar date');
	});

	test('UpdateLibraryBookMetadataUseCase persists valid year, month, and day values', async () => {
		const updates: UpdateBookMetadataInput[] = [];
		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({ year: 2020, month: null, day: null });
			},
			async updateMetadata(_id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
				updates.push(metadata);
				return createBook(metadata);
			}
		} as unknown as BookRepositoryPort;

		const useCase = new UpdateLibraryBookMetadataUseCase(repository, {
			async deleteForBookStorageKey(): Promise<void> {}
		});

		const result = await useCase.execute({
			bookId: 1,
			metadata: {
				year: 2020,
				month: 6,
				day: 12
			}
		});

		assert.equal(result.ok, true);
		const updatedMetadata = updates[0];
		if (!updatedMetadata) {
			throw new Error('Expected updated metadata');
		}
		assert.equal(updatedMetadata.year, 2020);
		assert.equal(updatedMetadata.month, 6);
		assert.equal(updatedMetadata.day, 12);
	});

	test('UpdateLibraryBookMetadataUseCase rejects impossible merged publish dates', async () => {
		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({ year: 2024, month: 5, day: 20 });
			}
		} as unknown as BookRepositoryPort;

		const useCase = new UpdateLibraryBookMetadataUseCase(repository, {
			async deleteForBookStorageKey(): Promise<void> {}
		});

		const clearYearResult = await useCase.execute({
			bookId: 1,
			metadata: {
				year: null
			}
		});
		assert.equal(clearYearResult.ok, false);
		assert.equal(clearYearResult.error.message, 'month requires year');

		const missingYearResult = await useCase.execute({
			bookId: 1,
			metadata: {
				year: null,
				month: 5
			}
		});
		assert.equal(missingYearResult.ok, false);
		assert.equal(missingYearResult.error.message, 'month requires year');
	});

	test('RefetchLibraryBookMetadataUseCase fills missing publish-date parts without overwriting populated values', async () => {
		const updates: UpdateBookMetadataInput[] = [];
		const repository = {
			async getById(id: number): Promise<Book | undefined> {
				if (id === 1) {
					return createBook({ id: 1, title: 'First Book', year: null, month: null, day: null });
				}
				return createBook({ id: 2, title: 'Second Book', year: 2021, month: 3, day: 2 });
			},
			async updateMetadata(_id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
				updates.push(metadata);
				return createBook({ id: _id, ...metadata });
			}
		} as unknown as BookRepositoryPort;

		const useCase = new RefetchLibraryBookMetadataUseCase(repository, {
			async lookup(input: {
				title: string;
				author: string | null;
				identifier: string | null;
				language?: string | null;
			}): Promise<ExternalBookMetadata> {
				if (input.title === 'First Book') {
					return {
						...emptyExternalMetadata(),
						year: 2021,
						month: 7,
						day: 14
					};
				}

				return {
					...emptyExternalMetadata(),
					year: 2022,
					month: 8,
					day: 5
				};
			}
		} as ExternalBookMetadataService);

		const filledResult = await useCase.execute({ bookId: 1 });
		assert.equal(filledResult.ok, true);
		assert.equal(updates[0]?.year, 2021);
		assert.equal(updates[0]?.month, 7);
		assert.equal(updates[0]?.day, 14);

		const preservedResult = await useCase.execute({ bookId: 2 });
		assert.equal(preservedResult.ok, true);
		assert.equal(updates[1]?.year, 2021);
		assert.equal(updates[1]?.month, 3);
		assert.equal(updates[1]?.day, 2);
	});

	test('GetLibraryBookDetailUseCase includes year, month, and day in the detail payload', async () => {
		const repository = {
			async getById(): Promise<Book | undefined> {
				return createBook({ year: 1984, month: 6, day: 8 });
			}
		} as unknown as BookRepositoryPort;

		const useCase = new GetLibraryBookDetailUseCase(
			repository,
			{
				async getByBookId(): Promise<Array<{ deviceId: string }>> {
					return [{ deviceId: 'kobo-1' }];
				}
			} as never,
			{
				async getBookShelfIds(): Promise<number[]> {
					return [3];
				}
			} as never
		);

		const result = await useCase.execute({ bookId: 1 });
		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected a successful result');
		}
		assert.equal(result.value.year, 1984);
		assert.equal(result.value.month, 6);
		assert.equal(result.value.day, 8);
	});
});
