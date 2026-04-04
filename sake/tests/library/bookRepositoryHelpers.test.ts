import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
	CreateBookInput,
	UpdateBookMetadataInput
} from '$lib/server/domain/entities/Book';
import {
	mapBookRow,
	mapBookWithDownloadRow,
	toCreateBookRow,
	toUpdateBookMetadataRow,
	type DbBookRow,
	type DbBookWithDownloadRow
} from '$lib/server/infrastructure/repositories/BookRepository.helpers';

function createDbBookRow(overrides: Partial<DbBookRow> = {}): DbBookRow {
	return {
		id: 1,
		s3StorageKey: 'books/example.epub',
		title: 'Example',
		zLibId: 'zlib-1',
		author: 'Author',
		publisher: 'Publisher',
		series: 'Series',
		volume: 'Vol. 1',
		seriesIndex: 1,
		edition: 'First',
		identifier: 'isbn',
		pages: 320,
		description: 'Desc',
		googleBooksId: 'google-1',
		openLibraryKey: 'ol-1',
		amazonAsin: 'asin-1',
		externalRating: 4.2,
		externalRatingCount: 10,
		cover: '/cover.jpg',
		extension: 'epub',
		filesize: 1234,
		language: 'en',
		year: 2024,
		month: 3,
		day: 2,
		progressStorageKey: 'progress/key',
		progressUpdatedAt: '2026-03-01T10:00:00.000Z',
		progressPercent: 0.5,
		progressBeforeRead: 0.4,
		rating: 5,
		readAt: '2026-03-02T10:00:00.000Z',
		archivedAt: '2026-03-03T10:00:00.000Z',
		excludeFromNewBooks: true,
		createdAt: '2026-03-01T09:00:00.000Z',
		deletedAt: '2026-03-04T10:00:00.000Z',
		trashExpiresAt: '2026-04-03T10:00:00.000Z',
		...overrides
	};
}

function createCreateBookInput(overrides: Partial<CreateBookInput> = {}): CreateBookInput {
	return {
		zLibId: 'zlib-1',
		s3_storage_key: 'books/example.epub',
		title: 'Example',
		author: 'Author',
		publisher: 'Publisher',
		series: 'Series',
		volume: 'Vol. 1',
		series_index: 1,
		edition: 'First',
		identifier: 'isbn',
		pages: 320,
		description: 'Desc',
		google_books_id: 'google-1',
		open_library_key: 'ol-1',
		amazon_asin: 'asin-1',
		external_rating: 4.2,
		external_rating_count: 10,
		cover: '/cover.jpg',
		extension: 'epub',
		filesize: 1234,
		language: 'en',
		year: 2024,
		month: 3,
		day: 2,
		...overrides
	};
}

function createUpdateBookMetadataInput(
	overrides: Partial<UpdateBookMetadataInput> = {}
): UpdateBookMetadataInput {
	return {
		zLibId: 'zlib-1',
		title: 'Updated',
		author: 'Author',
		publisher: 'Publisher',
		series: 'Series',
		volume: 'Vol. 2',
		series_index: 2,
		edition: 'Second',
		identifier: 'isbn-2',
		pages: 450,
		description: 'Updated desc',
		google_books_id: 'google-2',
		open_library_key: 'ol-2',
		amazon_asin: 'asin-2',
		external_rating: 4.8,
		external_rating_count: 42,
		cover: '/new-cover.jpg',
		extension: 'kepub',
		filesize: 4567,
		language: 'de',
		year: 2025,
		month: 4,
		day: 3,
		createdAt: '2026-03-05T10:00:00.000Z',
		...overrides
	};
}

describe('BookRepository helpers', () => {
	test('mapBookRow maps database fields to domain fields and normalizes invalid ratings', () => {
		const mapped = mapBookRow(createDbBookRow({ rating: 9 }));

		assert.equal(mapped.s3_storage_key, 'books/example.epub');
		assert.equal(mapped.series_index, 1);
		assert.equal(mapped.google_books_id, 'google-1');
		assert.equal(mapped.exclude_from_new_books, true);
		assert.equal(mapped.deleted_at, '2026-03-04T10:00:00.000Z');
		assert.equal(mapped.rating, null);
	});

	test('mapBookWithDownloadRow maps download state to a boolean', () => {
		const mappedTrue = mapBookWithDownloadRow({
			...createDbBookRow(),
			isDownloaded: 1
		} satisfies DbBookWithDownloadRow);
		const mappedFalse = mapBookWithDownloadRow({
			...createDbBookRow(),
			isDownloaded: 0
		} satisfies DbBookWithDownloadRow);

		assert.equal(mappedTrue.isDownloaded, true);
		assert.equal(mappedFalse.isDownloaded, false);
	});

	test('toCreateBookRow maps domain create input into database insert shape', () => {
		const createdAt = '2026-03-06T10:00:00.000Z';
		const row = toCreateBookRow(createCreateBookInput(), createdAt);

		assert.equal(row.s3StorageKey, 'books/example.epub');
		assert.equal(row.seriesIndex, 1);
		assert.equal(row.googleBooksId, 'google-1');
		assert.equal(row.createdAt, createdAt);
	});

	test('toUpdateBookMetadataRow maps domain metadata input into database update shape', () => {
		const row = toUpdateBookMetadataRow(createUpdateBookMetadataInput());

		assert.equal(row.title, 'Updated');
		assert.equal(row.seriesIndex, 2);
		assert.equal(row.openLibraryKey, 'ol-2');
		assert.equal(row.createdAt, '2026-03-05T10:00:00.000Z');
	});
});
