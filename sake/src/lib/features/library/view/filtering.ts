import type { LibraryBook } from '$lib/types/Library/Book';
import type { LibraryStatusFilter } from './types';
import { clampProgress, normalizeText } from './formatting';

export function matchesBookQuery(book: LibraryBook, query: string): boolean {
	const normalizedQuery = normalizeText(query);
	if (!normalizedQuery) {
		return true;
	}

	return [
		book.title,
		book.author,
		book.series,
		book.volume,
		book.extension,
		book.language,
		book.series_index
	]
		.map((value) => normalizeText(value === null || value === undefined ? null : String(value)))
		.some((value) => value.includes(normalizedQuery));
}

export function getProgressPercent(book: LibraryBook): number {
	return clampProgress(book.progressPercent);
}

export function getBookStatus(book: LibraryBook): Exclude<LibraryStatusFilter, 'all'> {
	const progress = getProgressPercent(book);
	if (book.read_at || progress >= 99.95) {
		return 'read';
	}
	if (progress >= 99.95) {
		return 'read';
	}
	if (progress > 0) {
		return 'reading';
	}
	return 'unread';
}

export function matchesBookStatus(book: LibraryBook, filter: LibraryStatusFilter): boolean {
	return filter === 'all' ? true : getBookStatus(book) === filter;
}
