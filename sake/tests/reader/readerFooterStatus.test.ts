import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	formatReaderFooterStatus,
	loadReaderFooterStatusMode,
	nextReaderFooterStatusMode,
	saveReaderFooterStatusMode,
	type ReaderFooterStatusSnapshot
} from '$lib/features/reader/readerFooterStatus';

class MemoryStorage {
	private readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

const snapshot: ReaderFooterStatusSnapshot = {
	percentFinished: 0.347,
	bookPaginationStatus: 'ready',
	bookPage: 143,
	bookTotalPages: 412,
	chapterPage: 4,
	chapterTotalPages: 12,
	now: new Date(2026, 5, 14, 9, 7)
};

describe('reader footer status', () => {
	test('cycles through KOReader-style status items', () => {
		assert.equal(nextReaderFooterStatusMode('percentage'), 'book-progress');
		assert.equal(nextReaderFooterStatusMode('book-progress'), 'chapter-progress');
		assert.equal(nextReaderFooterStatusMode('chapter-progress'), 'time');
		assert.equal(nextReaderFooterStatusMode('time'), 'percentage');
	});

	test('formats percentage, book progress, chapter progress, and time', () => {
		assert.equal(formatReaderFooterStatus('percentage', snapshot), '35%');
		assert.equal(formatReaderFooterStatus('book-progress', snapshot), '143 / 412');
		assert.equal(formatReaderFooterStatus('chapter-progress', snapshot), '4 / 12');
		assert.equal(formatReaderFooterStatus('time', snapshot), '09:07');
	});

	test('clamps book and chapter progress to their totals', () => {
		const finalPage = {
			...snapshot,
			bookPage: 413,
			chapterPage: 13
		};
		assert.equal(formatReaderFooterStatus('book-progress', finalPage), '412 / 412');
		assert.equal(formatReaderFooterStatus('chapter-progress', finalPage), '12 / 12');
	});

	test('shows distinct pending and unavailable book pagination states', () => {
		const unavailable = {
			...snapshot,
			bookPaginationStatus: 'pending' as const,
			bookPage: null,
			bookTotalPages: null,
			chapterPage: null,
			chapterTotalPages: null
		};
		assert.equal(formatReaderFooterStatus('book-progress', unavailable), 'Counting pages…');
		assert.equal(formatReaderFooterStatus('chapter-progress', unavailable), '35%');
		assert.equal(
			formatReaderFooterStatus('book-progress', {
				...unavailable,
				bookPaginationStatus: 'unavailable'
			}),
			'Pages unavailable'
		);
	});

	test('persists the selected status mode and rejects unknown stored values', () => {
		const storage = new MemoryStorage();
		assert.equal(loadReaderFooterStatusMode(storage), 'percentage');

		saveReaderFooterStatusMode(storage, 'time');
		assert.equal(loadReaderFooterStatusMode(storage), 'time');

		storage.setItem('readerFooterStatusMode', 'chapter-pages-left');
		assert.equal(loadReaderFooterStatusMode(storage), 'percentage');
	});
});
