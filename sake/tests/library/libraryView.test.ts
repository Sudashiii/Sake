import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	getProgressHistoryPageRange,
	matchesBookShelf,
	parseNullableNumber,
	sortBooks
} from '$lib/features/library/libraryView';
import type { LibraryBook } from '$lib/types/Library/Book';
import type { LibraryShelf } from '$lib/types/Library/Shelf';

function createBook(overrides: Partial<LibraryBook> = {}): LibraryBook {
	return {
		id: 1,
		zLibId: null,
		s3_storage_key: 'book.epub',
		title: 'Alpha',
		author: 'Author',
		cover: null,
		extension: 'epub',
		filesize: 1024,
		language: 'en',
		year: 2024,
		progress_storage_key: null,
		progress_updated_at: '2026-03-07T10:00:00.000Z',
		rating: 4,
		progressPercent: 50,
		shelfIds: [],
		createdAt: '2026-03-01T10:00:00.000Z',
		...overrides
	};
}

function createShelf(overrides: Partial<LibraryShelf> = {}): LibraryShelf {
	return {
		id: 1,
		name: 'Reading',
		icon: '📚',
		sortOrder: 0,
		ruleGroup: {
			id: 'root',
			type: 'group',
			connector: 'AND',
			children: []
		},
		createdAt: '2026-03-01T10:00:00.000Z',
		updatedAt: '2026-03-01T10:00:00.000Z',
		...overrides
	};
}

describe('libraryView', () => {
	test('parseNullableNumber returns null for blank strings and numbers for numeric strings', () => {
		assert.equal(parseNullableNumber('  '), null);
		assert.equal(parseNullableNumber('42'), 42);
	});

	test('sortBooks sorts by recent progress when requested', () => {
		const books = [
			createBook({ id: 1, progress_updated_at: '2026-03-01T10:00:00.000Z' }),
			createBook({ id: 2, progress_updated_at: '2026-03-08T10:00:00.000Z' })
		];

		const sorted = sortBooks(books, 'progressRecent');
		assert.deepEqual(sorted.map((book) => book.id), [2, 1]);
	});

	test('matchesBookShelf returns true for manual shelf assignments', () => {
		const book = createBook({ shelfIds: [7] });
		assert.equal(matchesBookShelf(book, 7), true);
		assert.equal(matchesBookShelf(book, 3), false);
	});

	test('matchesBookShelf evaluates shelf rules when a shelf map is provided', () => {
		const book = createBook({ title: 'Dune', shelfIds: [] });
		const shelf = createShelf({
			id: 5,
			ruleGroup: {
				id: 'root',
				type: 'group',
				connector: 'AND',
				children: [
					{
						id: 'c1',
						type: 'condition',
						field: 'title',
						operator: 'contains',
						value: 'dune'
					}
				]
			}
		});

		assert.equal(matchesBookShelf(book, 5, new Map([[5, shelf]])), true);
	});

	test('getProgressHistoryPageRange calculates page spans from the previous recorded progress state', () => {
		const history = [
			{ recordedAt: '2026-03-08T10:00:00.000Z', progressPercent: 40 },
			{ recordedAt: '2026-03-07T10:00:00.000Z', progressPercent: 10 }
		];

		assert.equal(getProgressHistoryPageRange(history, 0, 500), 'Read from page 50 to 200');
		assert.equal(getProgressHistoryPageRange(history, 1, 500), 'Read from page 0 to 50');
	});
});
