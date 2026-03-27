import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	applyBulkShelfSelection,
	getLibrarySortStorageKey,
		getVisibleBookIds,
	groupBooksBySeries,
	getProgressHistoryPageRange,
	isImportableExternalCoverUrl,
	matchesBookShelf,
	parseNullableNumber,
	pruneBookSelection,
	readStoredLibrarySort,
	sortBooks,
	toggleBookSelection
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
		series: null,
		volume: null,
		series_index: null,
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
	test('parseNullableNumber returns null for blank values and numbers for numeric input', () => {
		assert.equal(parseNullableNumber('  '), null);
		assert.equal(parseNullableNumber('42'), 42);
		assert.equal(parseNullableNumber(2.5), 2.5);
		assert.equal(parseNullableNumber(undefined), null);
	});

	test('getLibrarySortStorageKey separates the root library from shelf-specific preferences', () => {
		assert.equal(getLibrarySortStorageKey(null), 'librarySort:library');
		assert.equal(getLibrarySortStorageKey(7), 'librarySort:library:shelf:7');
	});

	test('readStoredLibrarySort prefers a shelf-specific sort and falls back to the root library sort', () => {
		const values = new Map<string, string>([
			['librarySort:library', 'progressRecent'],
			['librarySort:library:shelf:7', 'series']
		]);
		const storage = {
			getItem(key: string): string | null {
				return values.get(key) ?? null;
			}
		};

		assert.equal(readStoredLibrarySort(storage, 7), 'series');
		assert.equal(readStoredLibrarySort(storage, 8), 'progressRecent');
		assert.equal(readStoredLibrarySort(storage, null), 'progressRecent');
	});

	test('sortBooks sorts by recent progress when requested', () => {
		const books = [
			createBook({ id: 1, progress_updated_at: '2026-03-01T10:00:00.000Z' }),
			createBook({ id: 2, progress_updated_at: '2026-03-08T10:00:00.000Z' })
		];

		const sorted = sortBooks(books, 'progressRecent');
		assert.deepEqual(sorted.map((book) => book.id), [2, 1]);
	});

	test('sortBooks sorts by series name, then series index, then volume, then title', () => {
		const books = [
			createBook({ id: 1, title: 'Standalone', series: null, series_index: null }),
			createBook({ id: 2, title: 'Dune Messiah', series: 'Dune', series_index: 2 }),
			createBook({ id: 3, title: 'Dune', series: 'Dune', series_index: 1 }),
			createBook({ id: 4, title: 'Wyrd Sisters', series: 'Discworld', series_index: null, volume: '6' }),
			createBook({ id: 5, title: 'Mort', series: 'Discworld', series_index: null, volume: '4' })
		];

		const sorted = sortBooks(books, 'series');
		assert.deepEqual(sorted.map((book) => book.id), [5, 4, 3, 2, 1]);
	});

	test('groupBooksBySeries creates visible series sections with a trailing no-series bucket', () => {
		const groups = groupBooksBySeries([
			createBook({ id: 1, title: 'Guards! Guards!', series: 'Discworld', series_index: 8 }),
			createBook({ id: 2, title: 'Mort', series: 'Discworld', series_index: 4 }),
			createBook({ id: 3, title: 'Standalone', series: null })
		]);

		assert.deepEqual(
			groups.map((group) => ({
				label: group.label,
				bookIds: group.books.map((book) => book.id)
			})),
			[
				{ label: 'Discworld', bookIds: [1, 2] },
				{ label: 'No Series', bookIds: [3] }
			]
		);
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

	test('matchesBookShelf evaluates series and series-index rules when a shelf map is provided', () => {
		const book = createBook({
			title: 'Children of Dune',
			series: 'Dune',
			series_index: 3
		});
		const shelf = createShelf({
			id: 6,
			ruleGroup: {
				id: 'root',
				type: 'group',
				connector: 'AND',
				children: [
					{
						id: 'c1',
						type: 'condition',
						field: 'series',
						operator: 'equals',
						value: 'dune'
					},
					{
						id: 'c2',
						type: 'condition',
						field: 'seriesIndex',
						operator: 'gte',
						value: '3'
					}
				]
			}
		});

		assert.equal(matchesBookShelf(book, 6, new Map([[6, shelf]])), true);
	});

	test('getProgressHistoryPageRange calculates page spans from the previous recorded progress state', () => {
		const history = [
			{ recordedAt: '2026-03-08T10:00:00.000Z', progressPercent: 40 },
			{ recordedAt: '2026-03-07T10:00:00.000Z', progressPercent: 10 }
		];

		assert.equal(getProgressHistoryPageRange(history, 0, 500), 'Read from page 50 to 200');
		assert.equal(getProgressHistoryPageRange(history, 1, 500), 'Read from page 0 to 50');
	});

	test('isImportableExternalCoverUrl accepts non-internal http and https covers', () => {
		assert.equal(
			isImportableExternalCoverUrl('http://books.google.com/books/content?id=test-cover'),
			true
		);
		assert.equal(
			isImportableExternalCoverUrl('https://books.google.com/books/content?id=test-cover'),
			true
		);
		assert.equal(isImportableExternalCoverUrl('/api/library/covers/example.epub.jpg'), false);
	});

	test('toggleBookSelection adds and removes ids predictably', () => {
		assert.deepEqual(toggleBookSelection([], 4), [4]);
		assert.deepEqual(toggleBookSelection([4, 9], 4), [9]);
		assert.deepEqual(toggleBookSelection([9], 4), [4, 9]);
	});

	test('getVisibleBookIds and pruneBookSelection keep selection scoped to visible books', () => {
		const visibleIds = getVisibleBookIds([createBook({ id: 5 }), createBook({ id: 2 })]);

		assert.deepEqual(visibleIds, [2, 5]);
		assert.deepEqual(pruneBookSelection([2, 3, 5], visibleIds), [2, 5]);
	});

	test('applyBulkShelfSelection adds and removes shelves without duplicates', () => {
		assert.deepEqual(applyBulkShelfSelection([1, 4], 4, 'add'), [1, 4]);
		assert.deepEqual(applyBulkShelfSelection([1, 4], 7, 'add'), [1, 4, 7]);
		assert.deepEqual(applyBulkShelfSelection([1, 4, 7], 4, 'remove'), [1, 7]);
	});
});
