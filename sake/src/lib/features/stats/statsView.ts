import type { LibraryBook } from '$lib/types/Library/Book';
import type {
	ReadingActivityDay,
	ReadingActivityHour,
	ReadingActivityMonth,
	ReadingActivityStats,
	ReadingActivityWeek
} from '$lib/types/Stats/ReadingActivityStats';

export type DailyRange = 7 | 14 | 30;
export type BookStatus = 'Unread' | 'Reading' | 'Completed';

export interface DistributionEntry {
	name: string;
	value: number;
}

export interface RatingDistributionEntry {
	label: string;
	value: number;
}

export interface DailyChartEntry extends ReadingActivityDay {
	label: string;
}

export interface HeatmapCell {
	date: string;
	pagesRead: number;
}

export interface HeatmapData {
	weeks: Array<Array<HeatmapCell | null>>;
	monthLabels: Array<{ label: string; col: number }>;
	maxPages: number;
}

export const DAILY_RANGES: DailyRange[] = [7, 14, 30];
export const FORMAT_COLORS = ['#60a5fa', '#c084fc', '#c9a962', '#4ade80', '#f87171'];
export const STATUS_COLORS: Record<BookStatus, string> = {
	Unread: '#3a3d4a',
	Reading: '#c9a962',
	Completed: '#4ade80'
};

export function getBookStatus(book: LibraryBook): BookStatus {
	if (book.read_at) return 'Completed';
	if ((book.progressPercent ?? 0) > 0) return 'Reading';
	return 'Unread';
}

export function getFormat(book: LibraryBook): string {
	return (book.extension ?? 'UNKNOWN').toUpperCase();
}

export function formatDate(dateInput: string | null | undefined): string {
	if (!dateInput) return '—';
	return new Date(dateInput).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

export function formatNumber(value: number): string {
	return value.toLocaleString('en-US');
}

export function toDailyLabel(dateKey: string): string {
	const date = new Date(`${dateKey}T00:00:00.000Z`);
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function getHeatColor(pages: number, maxPages: number): string {
	if (pages === 0 || maxPages <= 0) return '#1e2230';
	const ratio = pages / maxPages;
	if (ratio < 0.15) return '#2a2518';
	if (ratio < 0.3) return '#3d3520';
	if (ratio < 0.5) return '#5a4a2a';
	if (ratio < 0.7) return '#8a7540';
	return '#c9a962';
}

export function buildHeatmap(input: ReadingActivityDay[]): HeatmapData {
	if (input.length === 0) {
		return { weeks: [], monthLabels: [], maxPages: 0 };
	}

	const dateMap = new Map(input.map((entry) => [entry.date, entry.pagesRead]));
	const start = new Date(`${input[0].date}T00:00:00.000Z`);
	const end = new Date(`${input[input.length - 1].date}T00:00:00.000Z`);
	const adjustedStart = new Date(start);
	while (adjustedStart.getUTCDay() !== 1) {
		adjustedStart.setUTCDate(adjustedStart.getUTCDate() - 1);
	}

	const weeks: Array<Array<HeatmapCell | null>> = [];
	const monthLabels: Array<{ label: string; col: number }> = [];
	let maxPages = 0;
	let week: Array<HeatmapCell | null> = Array(7).fill(null);
	let weekIndex = 0;
	let lastMonth = '';
	const cursor = new Date(adjustedStart);

	while (cursor <= end) {
		const dateKey = cursor.toISOString().slice(0, 10);
		const dayOfWeek = cursor.getUTCDay() === 0 ? 6 : cursor.getUTCDay() - 1;
		const pagesRead = dateMap.get(dateKey) ?? 0;
		maxPages = Math.max(maxPages, pagesRead);

		if (dateMap.has(dateKey)) {
			week[dayOfWeek] = { date: dateKey, pagesRead };
		}

		const monthKey = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
		if (monthKey !== lastMonth) {
			const nextLabel = {
				label: cursor.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
				col: weekIndex
			};

			const previousLabel = monthLabels[monthLabels.length - 1];
			if (previousLabel && previousLabel.col === nextLabel.col) {
				monthLabels[monthLabels.length - 1] = nextLabel;
			} else {
				monthLabels.push(nextLabel);
			}
			lastMonth = monthKey;
		}

		if (dayOfWeek === 6) {
			weeks.push(week);
			week = Array(7).fill(null);
			weekIndex += 1;
		}

		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	if (week.some((cell) => cell !== null)) {
		weeks.push(week);
	}

	return { weeks, monthLabels, maxPages };
}

export function buildConicGradient(entries: Array<{ value: number }>, colors: string[]): string {
	const total = entries.reduce((sum, entry) => sum + entry.value, 0);
	if (total <= 0) {
		return '#1e2230';
	}

	let offset = 0;
	const segments = entries.map((entry, index) => {
		const start = (offset / total) * 360;
		offset += entry.value;
		const end = (offset / total) * 360;
		return `${colors[index % colors.length]} ${start}deg ${end}deg`;
	});

	return `conic-gradient(${segments.join(', ')})`;
}

export function buildRecentDaily(activity: ReadingActivityStats | null, dailyRange: DailyRange): DailyChartEntry[] {
	if (!activity) return [];
	return activity.daily.slice(-dailyRange).map((entry) => ({
		...entry,
		label: toDailyLabel(entry.date)
	}));
}

export function buildFormatDistribution(books: LibraryBook[]): DistributionEntry[] {
	const counts = new Map<string, number>();
	for (const book of books) {
		const format = getFormat(book);
		counts.set(format, (counts.get(format) ?? 0) + 1);
	}

	return Array.from(counts.entries())
		.map(([name, value]) => ({ name, value }))
		.sort((a, b) => b.value - a.value);
}

export function buildStatusDistribution(books: LibraryBook[]): Array<{ name: BookStatus; value: number }> {
	let unread = 0;
	let reading = 0;
	let completed = 0;

	for (const book of books) {
		const status = getBookStatus(book);
		if (status === 'Unread') unread += 1;
		else if (status === 'Reading') reading += 1;
		else completed += 1;
	}

	return [
		{ name: 'Unread', value: unread },
		{ name: 'Reading', value: reading },
		{ name: 'Completed', value: completed }
	];
}

export function buildRatingDistribution(books: LibraryBook[]): RatingDistributionEntry[] {
	const counts = [0, 0, 0, 0, 0, 0];
	for (const book of books) {
		const rating = book.rating ?? 0;
		if (rating >= 1 && rating <= 5) {
			counts[rating] += 1;
		}
	}
	return [1, 2, 3, 4, 5].map((rating) => ({ label: `${rating}★`, value: counts[rating] }));
}

export function buildStreakPreviewCells(currentStreak: number): number[] {
	const count = Math.min(currentStreak, 14);
	return Array.from({ length: count }, (_, index) => index);
}

export function buildStatsViewModel(books: LibraryBook[], activity: ReadingActivityStats | null, dailyRange: DailyRange) {
	const completedBooksCount = books.filter((book) => Boolean(book.read_at)).length;
	const booksByStatus = buildStatusDistribution(books);
	const unreadBooksCount = booksByStatus.find((entry) => entry.name === 'Unread')?.value ?? 0;
	const readingBooksCount = booksByStatus.find((entry) => entry.name === 'Reading')?.value ?? 0;
	const recentDaily = buildRecentDaily(activity, dailyRange);
	const recentWeekly: ReadingActivityWeek[] = activity?.weekly.slice(-12) ?? [];
	const recentMonthly: ReadingActivityMonth[] = activity?.monthly ?? [];
	const heatmap = buildHeatmap(activity?.daily ?? []);
	const booksByFormat = buildFormatDistribution(books);
	const ratingDistribution = buildRatingDistribution(books);
	const maxDailyPages = Math.max(...recentDaily.map((entry) => entry.pagesRead), 1);
	const maxWeeklyPages = Math.max(...recentWeekly.map((entry) => entry.pages), 1);
	const maxHourlyPages = Math.max(...(activity?.hourly ?? []).map((entry: ReadingActivityHour) => entry.pages), 1);
	const maxMonthlyPages = Math.max(...recentMonthly.map((entry) => entry.pages), 1);
	const maxRatingCount = Math.max(...ratingDistribution.map((entry) => entry.value), 1);
	const maxStatusCount = Math.max(...booksByStatus.map((entry) => entry.value), 1);
	const readingPercentage = activity && activity.totals.totalDays > 0
		? Math.round((activity.totals.daysActive / activity.totals.totalDays) * 100)
		: 0;
	const formatPieGradient = buildConicGradient(booksByFormat, FORMAT_COLORS);
	const streakPreviewCells = buildStreakPreviewCells(activity?.streak.current ?? 0);

	return {
		completedBooksCount,
		readingBooksCount,
		unreadBooksCount,
		booksByFormat,
		booksByStatus,
		ratingDistribution,
		recentDaily,
		recentWeekly,
		recentMonthly,
		heatmap,
		maxDailyPages,
		maxWeeklyPages,
		maxHourlyPages,
		maxMonthlyPages,
		maxRatingCount,
		maxStatusCount,
		readingPercentage,
		formatPieGradient,
		streakPreviewCells
	};
}
