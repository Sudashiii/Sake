import type { BookProgressHistoryRepositoryPort } from '$lib/server/application/ports/BookProgressHistoryRepositoryPort';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface GetReadingActivityStatsInput {
	days: number;
}

interface DailyReadingStat {
	date: string;
	pagesRead: number;
	sessions: number;
}

interface HourlyReadingStat {
	hour: number;
	label: string;
	pages: number;
	sessions: number;
}

interface WeeklyReadingStat {
	week: string;
	weekStart: string;
	pages: number;
	sessions: number;
}

interface MonthlyReadingStat {
	month: string;
	monthKey: string;
	pages: number;
	booksFinished: number;
	avgPagesPerDay: number;
}

interface ReadingStreak {
	current: number;
	longest: number;
	longestStart: string | null;
	longestEnd: string | null;
}

interface ReadingTotals {
	totalPages: number;
	totalSessions: number;
	daysActive: number;
	totalDays: number;
	avgPagesPerDay: number;
	avgPagesOnActiveDay: number;
	bestDay: {
		date: string | null;
		pagesRead: number;
	};
}

interface GetReadingActivityStatsResult {
	success: true;
	range: {
		startDate: string;
		endDate: string;
		days: number;
	};
	daily: DailyReadingStat[];
	hourly: HourlyReadingStat[];
	weekly: WeeklyReadingStat[];
	monthly: MonthlyReadingStat[];
	streak: ReadingStreak;
	totals: ReadingTotals;
}

function clampPercent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}

function toUtcDateKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function parseDateKeyUtc(dateKey: string): Date {
	return new Date(`${dateKey}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function getWeekStartMondayUtc(dateKey: string): string {
	const date = parseDateKeyUtc(dateKey);
	const day = date.getUTCDay();
	const mondayOffset = day === 0 ? -6 : 1 - day;
	date.setUTCDate(date.getUTCDate() + mondayOffset);
	return toUtcDateKey(date);
}

function getHourLabel(hour: number): string {
	const period = hour < 12 ? 'AM' : 'PM';
	const displayHour = hour % 12 === 0 ? 12 : hour % 12;
	return `${displayHour}${period}`;
}

function getMonthKeyFromDateKey(dateKey: string): string {
	return dateKey.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
	const [yearRaw, monthRaw] = monthKey.split('-');
	const year = Number(yearRaw);
	const monthIndex = Number(monthRaw) - 1;
	const date = new Date(Date.UTC(year, monthIndex, 1));
	return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatWeekLabel(dateKey: string): string {
	const date = parseDateKeyUtc(dateKey);
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export class GetReadingActivityStatsUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly progressHistoryRepository: BookProgressHistoryRepositoryPort
	) {}

	async execute(input: GetReadingActivityStatsInput): Promise<ApiResult<GetReadingActivityStatsResult>> {
		const nowUtc = new Date();
		const endDate = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate()));
		const startDate = addUtcDays(endDate, -(input.days - 1));
		const startDateKey = toUtcDateKey(startDate);
		const endDateKey = toUtcDateKey(endDate);

		const dailyMap = new Map<string, DailyReadingStat>();
		for (let i = 0; i < input.days; i += 1) {
			const dateKey = toUtcDateKey(addUtcDays(startDate, i));
			dailyMap.set(dateKey, { date: dateKey, pagesRead: 0, sessions: 0 });
		}

		const hourlyBuckets: HourlyReadingStat[] = Array.from({ length: 24 }, (_, hour) => ({
			hour,
			label: getHourLabel(hour),
			pages: 0,
			sessions: 0
		}));

		const books = await this.bookRepository.getAllForStats();
		const historiesByBook = new Map<number, Awaited<ReturnType<BookProgressHistoryRepositoryPort['getByBookId']>>>();

		await Promise.all(
			books.map(async (book) => {
				const history = await this.progressHistoryRepository.getByBookId(book.id);
				historiesByBook.set(book.id, history);
			})
		);
		let globalFirstEntry: { bookId: number; id: number; recordedAt: string } | null = null;
		for (const [bookId, history] of historiesByBook.entries()) {
			for (const entry of history) {
				if (
					!globalFirstEntry ||
					entry.recordedAt < globalFirstEntry.recordedAt ||
					(entry.recordedAt === globalFirstEntry.recordedAt && entry.id < globalFirstEntry.id)
				) {
					globalFirstEntry = { bookId, id: entry.id, recordedAt: entry.recordedAt };
				}
			}
		}

		for (const book of books) {
			if (!book.pages || book.pages <= 0) {
				continue;
			}

			const history = historiesByBook.get(book.id) ?? [];
			if (history.length === 0) {
				continue;
			}

			const ascending = [...history].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
			let previousPercent = 0;
			const firstEntryId = globalFirstEntry?.id;
			const firstEntryBookId = globalFirstEntry?.bookId;

			for (const entry of ascending) {
				const currentPercent = clampPercent(entry.progressPercent);
				if (
					firstEntryId !== undefined &&
					firstEntryBookId !== undefined &&
					entry.id === firstEntryId &&
					book.id === firstEntryBookId
				) {
					// Ignore page credit for the very first history record in the whole library.
					previousPercent = currentPercent;
					continue;
				}

				if (currentPercent < previousPercent) {
					// Reading state may have been reset; continue from new baseline.
					previousPercent = currentPercent;
					continue;
				}

				const deltaPercent = currentPercent - previousPercent;
				if (deltaPercent <= 0) {
					continue;
				}

				const pagesDelta = Math.max(0, Math.round(deltaPercent * book.pages));
				previousPercent = currentPercent;
				if (pagesDelta <= 0) {
					continue;
				}

				const entryDate = new Date(entry.recordedAt);
				if (Number.isNaN(entryDate.getTime())) {
					continue;
				}

				const entryDateKey = toUtcDateKey(entryDate);
				if (entryDateKey < startDateKey || entryDateKey > endDateKey) {
					continue;
				}

				const day = dailyMap.get(entryDateKey);
				if (!day) {
					continue;
				}

				day.pagesRead += pagesDelta;
				day.sessions += 1;

				const hour = entryDate.getUTCHours();
				hourlyBuckets[hour].pages += pagesDelta;
				hourlyBuckets[hour].sessions += 1;
			}
		}

		const daily = Array.from(dailyMap.values());
		const daysActive = daily.filter((day) => day.pagesRead > 0).length;
		const totalPages = daily.reduce((sum, day) => sum + day.pagesRead, 0);
		const totalSessions = daily.reduce((sum, day) => sum + day.sessions, 0);
		const bestDay = daily.reduce(
			(best, day) => (day.pagesRead > best.pagesRead ? day : best),
			{ date: null as string | null, pagesRead: 0 }
		);

		let currentStreak = 0;
		for (let i = daily.length - 1; i >= 0; i -= 1) {
			if (daily[i].pagesRead > 0) {
				currentStreak += 1;
			} else {
				break;
			}
		}

		let longestStreak = 0;
		let longestStart: string | null = null;
		let longestEnd: string | null = null;
		let streakStartIndex = -1;
		let streakLength = 0;

		for (let i = 0; i < daily.length; i += 1) {
			if (daily[i].pagesRead > 0) {
				if (streakLength === 0) {
					streakStartIndex = i;
				}
				streakLength += 1;
				if (streakLength > longestStreak) {
					longestStreak = streakLength;
					longestStart = daily[streakStartIndex].date;
					longestEnd = daily[i].date;
				}
			} else {
				streakLength = 0;
				streakStartIndex = -1;
			}
		}

		const weeklyMap = new Map<string, WeeklyReadingStat>();
		for (const day of daily) {
			const weekStart = getWeekStartMondayUtc(day.date);
			const existing = weeklyMap.get(weekStart);
			if (!existing) {
				weeklyMap.set(weekStart, {
					week: formatWeekLabel(weekStart),
					weekStart,
					pages: day.pagesRead,
					sessions: day.sessions
				});
				continue;
			}
			existing.pages += day.pagesRead;
			existing.sessions += day.sessions;
		}
		const weekly = Array.from(weeklyMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

		const monthlyMap = new Map<string, MonthlyReadingStat & { daysCount: number }>();
		for (const day of daily) {
			const monthKey = getMonthKeyFromDateKey(day.date);
			const existing = monthlyMap.get(monthKey);
			if (!existing) {
				monthlyMap.set(monthKey, {
					month: formatMonthLabel(monthKey),
					monthKey,
					pages: day.pagesRead,
					booksFinished: 0,
					avgPagesPerDay: 0,
					daysCount: 1
				});
				continue;
			}
			existing.pages += day.pagesRead;
			existing.daysCount += 1;
		}

		for (const book of books) {
			if (!book.read_at) {
				continue;
			}
			const readDateKey = toUtcDateKey(new Date(book.read_at));
			if (readDateKey < startDateKey || readDateKey > endDateKey) {
				continue;
			}
			const monthKey = getMonthKeyFromDateKey(readDateKey);
			const month = monthlyMap.get(monthKey);
			if (month) {
				month.booksFinished += 1;
			}
		}

		const monthly: MonthlyReadingStat[] = Array.from(monthlyMap.values())
			.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
			.map((month) => ({
				month: month.month,
				monthKey: month.monthKey,
				pages: month.pages,
				booksFinished: month.booksFinished,
				avgPagesPerDay: month.daysCount > 0 ? Math.round(month.pages / month.daysCount) : 0
			}));

		const result: GetReadingActivityStatsResult = {
			success: true,
			range: {
				startDate: startDateKey,
				endDate: endDateKey,
				days: input.days
			},
			daily,
			hourly: hourlyBuckets,
			weekly,
			monthly,
			streak: {
				current: currentStreak,
				longest: longestStreak,
				longestStart,
				longestEnd
			},
			totals: {
				totalPages,
				totalSessions,
				daysActive,
				totalDays: daily.length,
				avgPagesPerDay: daily.length > 0 ? Math.round(totalPages / daily.length) : 0,
				avgPagesOnActiveDay: daysActive > 0 ? Math.round(totalPages / daysActive) : 0,
				bestDay
			}
		};

		return apiOk(result);
	}
}
