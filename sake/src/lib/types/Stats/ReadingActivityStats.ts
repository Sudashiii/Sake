export interface ReadingActivityDay {
	date: string;
	pagesRead: number;
	sessions: number;
}

export interface ReadingActivityHour {
	hour: number;
	label: string;
	pages: number;
	sessions: number;
}

export interface ReadingActivityWeek {
	week: string;
	weekStart: string;
	pages: number;
	sessions: number;
}

export interface ReadingActivityMonth {
	month: string;
	monthKey: string;
	pages: number;
	booksFinished: number;
	avgPagesPerDay: number;
}

export interface ReadingActivityStreak {
	current: number;
	longest: number;
	longestStart: string | null;
	longestEnd: string | null;
}

export interface ReadingActivityTotals {
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

export interface ReadingActivityStats {
	success: boolean;
	range: {
		startDate: string;
		endDate: string;
		days: number;
	};
	daily: ReadingActivityDay[];
	hourly: ReadingActivityHour[];
	weekly: ReadingActivityWeek[];
	monthly: ReadingActivityMonth[];
	streak: ReadingActivityStreak;
	totals: ReadingActivityTotals;
}
