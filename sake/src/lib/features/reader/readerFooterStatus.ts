export const READER_FOOTER_STATUS_MODES = [
	'percentage',
	'book-progress',
	'chapter-progress',
	'time'
] as const;

export type ReaderFooterStatusMode = (typeof READER_FOOTER_STATUS_MODES)[number];
export type ReaderBookPaginationStatus = 'pending' | 'ready' | 'unavailable';

export interface ReaderFooterStatusSnapshot {
	percentFinished: number;
	bookPaginationStatus: ReaderBookPaginationStatus;
	bookPage: number | null;
	bookTotalPages: number | null;
	chapterPage: number | null;
	chapterTotalPages: number | null;
	now: Date;
}

interface PreferenceStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const FOOTER_STATUS_MODE_KEY = 'readerFooterStatusMode';

const MODE_LABELS: Record<ReaderFooterStatusMode, string> = {
	percentage: 'progress percentage',
	'book-progress': 'current page in book',
	'chapter-progress': 'current page in chapter',
	time: 'current time'
};

export function nextReaderFooterStatusMode(
	mode: ReaderFooterStatusMode
): ReaderFooterStatusMode {
	const currentIndex = READER_FOOTER_STATUS_MODES.indexOf(mode);
	return READER_FOOTER_STATUS_MODES[
		(currentIndex + 1) % READER_FOOTER_STATUS_MODES.length
	];
}

export function loadReaderFooterStatusMode(
	storage: PreferenceStorage
): ReaderFooterStatusMode {
	const storedMode = storage.getItem(FOOTER_STATUS_MODE_KEY);
	return READER_FOOTER_STATUS_MODES.find((mode) => mode === storedMode) ?? 'percentage';
}

export function saveReaderFooterStatusMode(
	storage: PreferenceStorage,
	mode: ReaderFooterStatusMode
): void {
	storage.setItem(FOOTER_STATUS_MODE_KEY, mode);
}

export function readerFooterStatusModeLabel(mode: ReaderFooterStatusMode): string {
	return MODE_LABELS[mode];
}

export function formatReaderFooterStatus(
	mode: ReaderFooterStatusMode,
	snapshot: ReaderFooterStatusSnapshot
): string {
	switch (mode) {
		case 'book-progress':
			return formatBookProgress(snapshot);
		case 'chapter-progress':
			return formatChapterProgress(snapshot) ?? formatPercentage(snapshot.percentFinished);
		case 'time':
			return `${String(snapshot.now.getHours()).padStart(2, '0')}:${String(
				snapshot.now.getMinutes()
			).padStart(2, '0')}`;
		case 'percentage':
			return formatPercentage(snapshot.percentFinished);
	}
}

function formatPercentage(percentFinished: number): string {
	const normalized = Number.isFinite(percentFinished)
		? Math.max(0, Math.min(1, percentFinished))
		: 0;
	return `${Math.round(normalized * 100)}%`;
}

function formatBookProgress(snapshot: ReaderFooterStatusSnapshot): string {
	if (snapshot.bookPaginationStatus === 'pending') return 'Counting pages…';
	if (snapshot.bookPaginationStatus === 'unavailable') return 'Pages unavailable';
	const total = positiveInteger(snapshot.bookTotalPages);
	const page = positiveInteger(snapshot.bookPage);
	if (total === null || page === null) return 'Counting pages…';
	return `${Math.min(page, total)} / ${total}`;
}

function formatChapterProgress(snapshot: ReaderFooterStatusSnapshot): string | null {
	const total = positiveInteger(snapshot.chapterTotalPages);
	const page = positiveInteger(snapshot.chapterPage);
	if (total === null || page === null) return null;
	return `${Math.min(page, total)} / ${total}`;
}

function positiveInteger(value: number | null): number | null {
	if (value === null || !Number.isFinite(value) || value < 1) return null;
	return Math.floor(value);
}
