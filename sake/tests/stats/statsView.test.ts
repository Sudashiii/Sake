import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { LibraryBook } from '$lib/types/Library/Book';
import type { ReadingActivityStats } from '$lib/types/Stats/ReadingActivityStats';
import {
	buildHeatmap,
	buildStatsViewModel,
	formatDate,
	getBookStatus,
	getHeatColor
} from '$lib/features/stats/statsView';

const makeBook = (overrides: Partial<LibraryBook> = {}): LibraryBook => ({
	id: 1,
	zLibId: null,
	s3_storage_key: 'book.epub',
	title: 'Book',
	author: null,
	cover: null,
	extension: 'epub',
	filesize: null,
	language: null,
	year: null,
	month: null,
	day: null,
	progress_storage_key: null,
	progress_updated_at: null,
	rating: null,
	read_at: null,
	archived_at: null,
	exclude_from_new_books: false,
	progressPercent: 0,
	shelfIds: [],
	createdAt: null,
	...overrides
});

const activity: ReadingActivityStats = {
	success: true,
	range: { startDate: '2026-01-01', endDate: '2026-01-14', days: 14 },
	daily: [
		{ date: '2026-01-01', pagesRead: 10, sessions: 1 },
		{ date: '2026-01-02', pagesRead: 20, sessions: 1 },
		{ date: '2026-01-03', pagesRead: 0, sessions: 0 }
	],
	hourly: [
		{ hour: 8, label: '8AM', pages: 10, sessions: 1 },
		{ hour: 9, label: '9AM', pages: 20, sessions: 1 }
	],
	weekly: [{ week: 'Jan 1', weekStart: '2026-01-01', pages: 30, sessions: 2 }],
	monthly: [{ month: 'Jan', monthKey: '2026-01', pages: 30, booksFinished: 1, avgPagesPerDay: 1 }],
	streak: { current: 3, longest: 5, longestStart: '2026-01-01', longestEnd: '2026-01-05' },
	totals: {
		totalPages: 30,
		totalSessions: 2,
		daysActive: 2,
		totalDays: 14,
		avgPagesPerDay: 2,
		avgPagesOnActiveDay: 15,
		bestDay: { date: '2026-01-02', pagesRead: 20 }
	}
};

describe('statsView', () => {
	test('getBookStatus distinguishes unread, reading, and completed', () => {
		assert.equal(getBookStatus(makeBook()), 'Unread');
		assert.equal(getBookStatus(makeBook({ progressPercent: 12 })), 'Reading');
		assert.equal(getBookStatus(makeBook({ read_at: '2026-01-03' })), 'Completed');
	});

	test('buildHeatmap groups days into monday-based weeks', () => {
		const heatmap = buildHeatmap(activity.daily);
		assert.ok(heatmap.weeks.length > 0);
		assert.equal(heatmap.maxPages, 20);
		assert.equal(heatmap.monthLabels[0]?.label, 'Jan');
	});

	test('buildStatsViewModel derives chart maxima and distributions', () => {
		const view = buildStatsViewModel(
			[
				makeBook(),
				makeBook({ id: 2, progressPercent: 15 }),
				makeBook({ id: 3, read_at: '2026-01-03', rating: 4 })
			],
			activity,
			7
		);

		assert.equal(view.completedBooksCount, 1);
		assert.equal(view.readingBooksCount, 1);
		assert.equal(view.unreadBooksCount, 1);
		assert.equal(view.maxDailyPages, 20);
		assert.equal(view.maxWeeklyPages, 30);
		assert.equal(view.maxMonthlyPages, 30);
		assert.equal(view.ratingDistribution.find((entry) => entry.label === '4★')?.value, 1);
	});

	test('formatDate and heat colors keep fallback behavior stable', () => {
		assert.equal(formatDate(null), '—');
		assert.equal(getHeatColor(0, 0), '#1e2230');
		assert.equal(getHeatColor(20, 20), '#c9a962');
	});
});
