import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { findBookByOpenBookId } from '$lib/features/library/libraryDetailLoader';
import { parseOpenBookIdFromSearch } from '$lib/features/library/libraryRouteUrlState';
import type { LibraryBook } from '$lib/types/Library/Book';

function createBook(overrides: Partial<LibraryBook> = {}): LibraryBook {
	return {
		id: 1,
		zLibId: null,
		s3_storage_key: 'book.epub',
		title: 'Alpha',
		author: 'Author',
		series: null,
		volume: null,
		series_index: null,
		cover: null,
		extension: 'epub',
		filesize: 1024,
		language: 'en',
		year: 2024,
		month: null,
		day: null,
		progress_storage_key: null,
		progress_updated_at: '2026-03-07T10:00:00.000Z',
		rating: 4,
		progressPercent: 50,
		shelfIds: [],
		createdAt: '2026-03-01T10:00:00.000Z',
		...overrides
	};
}

describe('library route helpers', () => {
	test('parseOpenBookIdFromSearch returns null for missing and malformed values', () => {
		assert.equal(parseOpenBookIdFromSearch(''), null);
		assert.equal(parseOpenBookIdFromSearch('?view=library'), null);
		assert.equal(parseOpenBookIdFromSearch('?openBookId=abc'), null);
		assert.equal(parseOpenBookIdFromSearch('?openBookId=12abc'), null);
		assert.equal(parseOpenBookIdFromSearch('?openBookId=-5'), null);
	});

	test('parseOpenBookIdFromSearch accepts numeric values with or without a leading question mark', () => {
		assert.equal(parseOpenBookIdFromSearch('openBookId=7'), 7);
		assert.equal(parseOpenBookIdFromSearch('?openBookId=42'), 42);
	});

	test('findBookByOpenBookId returns null for null or missing ids', () => {
		const books = [createBook({ id: 1 }), createBook({ id: 2, title: 'Beta' })];

		assert.equal(findBookByOpenBookId(books, null), null);
		assert.equal(findBookByOpenBookId(books, 99), null);
	});

	test('findBookByOpenBookId returns the matching book when present', () => {
		const books = [createBook({ id: 1 }), createBook({ id: 2, title: 'Beta' })];

		assert.deepEqual(findBookByOpenBookId(books, 2), books[1]);
	});
});
