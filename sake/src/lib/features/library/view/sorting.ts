import type { LibraryBook } from '$lib/types/Library/Book';
import type {
	LibraryBookGroup,
	LibrarySortDirection,
	LibrarySortPreference
} from './types';

export function isSeriesSortPreference(sort: LibrarySortPreference): boolean {
	return sort.field === 'series';
}

export function sortBooks(list: LibraryBook[], sort: LibrarySortPreference): LibraryBook[] {
	const copy = [...list];
	return copy.sort((left, right) => compareBooks(left, right, sort));
}

function normalizeSeriesLabel(value: string | null | undefined): string {
	return value?.trim() ?? '';
}

function compareLabel(left: string, right: string): number {
	return left.localeCompare(right, undefined, {
		numeric: true,
		sensitivity: 'base'
	});
}

function compareRequiredText(
	left: string,
	right: string,
	direction: LibrarySortDirection
): number {
	const ascending = compareLabel(left, right);
	return direction === 'asc' ? ascending : -ascending;
}

function compareOptionalText(
	left: string | null | undefined,
	right: string | null | undefined,
	direction: LibrarySortDirection
): number {
	const leftValue = normalizeSeriesLabel(left);
	const rightValue = normalizeSeriesLabel(right);

	if (!leftValue && !rightValue) {
		return 0;
	}
	if (!leftValue) {
		return 1;
	}
	if (!rightValue) {
		return -1;
	}

	return compareRequiredText(leftValue, rightValue, direction);
}

function compareOptionalNumber(
	left: number | null | undefined,
	right: number | null | undefined,
	direction: LibrarySortDirection
): number {
	const leftValue = typeof left === 'number' && Number.isFinite(left) ? left : null;
	const rightValue = typeof right === 'number' && Number.isFinite(right) ? right : null;

	if (leftValue === null && rightValue === null) {
		return 0;
	}
	if (leftValue === null) {
		return 1;
	}
	if (rightValue === null) {
		return -1;
	}

	return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
}

function parseSortTimestamp(value: string | null | undefined): number | null {
	if (!value) {
		return null;
	}

	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function compareOptionalTimestamp(
	left: string | null | undefined,
	right: string | null | undefined,
	direction: LibrarySortDirection
): number {
	return compareOptionalNumber(parseSortTimestamp(left), parseSortTimestamp(right), direction);
}

function compareTieBreakers(left: LibraryBook, right: LibraryBook): number {
	const titleCompare = compareLabel(left.title, right.title);
	if (titleCompare !== 0) {
		return titleCompare;
	}

	const createdAtCompare = compareOptionalTimestamp(left.createdAt, right.createdAt, 'desc');
	if (createdAtCompare !== 0) {
		return createdAtCompare;
	}

	return left.id - right.id;
}

function compareSeriesIndices(left: LibraryBook, right: LibraryBook): number {
	return compareOptionalNumber(left.series_index, right.series_index, 'asc');
}

function compareBooksBySeries(
	left: LibraryBook,
	right: LibraryBook,
	direction: LibrarySortDirection
): number {
	const seriesCompare = compareOptionalText(left.series, right.series, direction);
	if (seriesCompare !== 0) {
		return seriesCompare;
	}

	const sameSeries = normalizeSeriesLabel(left.series).length > 0;
	if (!sameSeries) {
		return compareTieBreakers(left, right);
	}

	const seriesIndexCompare = compareSeriesIndices(left, right);
	if (seriesIndexCompare !== 0) {
		return seriesIndexCompare;
	}

	const volumeCompare = compareOptionalText(left.volume, right.volume, 'asc');
	if (volumeCompare !== 0) {
		return volumeCompare;
	}

	return compareTieBreakers(left, right);
}

function compareBooksByPublicationDate(
	left: LibraryBook,
	right: LibraryBook,
	direction: LibrarySortDirection
): number {
	const yearCompare = compareOptionalNumber(left.year, right.year, direction);
	if (yearCompare !== 0) {
		return yearCompare;
	}

	const monthCompare = compareOptionalNumber(left.month, right.month, direction);
	if (monthCompare !== 0) {
		return monthCompare;
	}

	return compareOptionalNumber(left.day, right.day, direction);
}

function compareBooks(
	left: LibraryBook,
	right: LibraryBook,
	sort: LibrarySortPreference
): number {
	let primaryCompare = 0;

	if (sort.field === 'dateAdded') {
		primaryCompare = compareOptionalTimestamp(left.createdAt, right.createdAt, sort.direction);
	} else if (sort.field === 'title') {
		primaryCompare = compareRequiredText(left.title, right.title, sort.direction);
	} else if (sort.field === 'author') {
		primaryCompare = compareOptionalText(left.author, right.author, sort.direction);
	} else if (sort.field === 'series') {
		primaryCompare = compareBooksBySeries(left, right, sort.direction);
	} else if (sort.field === 'publishedDate') {
		primaryCompare = compareBooksByPublicationDate(left, right, sort.direction);
	} else {
		primaryCompare = compareOptionalTimestamp(
			left.progress_updated_at,
			right.progress_updated_at,
			sort.direction
		);
	}

	if (primaryCompare !== 0) {
		return primaryCompare;
	}

	return compareTieBreakers(left, right);
}

export function groupBooksBySeries(books: LibraryBook[]): LibraryBookGroup[] {
	const groups: LibraryBookGroup[] = [];
	const groupById = new Map<string, LibraryBookGroup>();

	for (const book of books) {
		const seriesLabel = normalizeSeriesLabel(book.series);
		const id = seriesLabel ? `series:${seriesLabel.toLowerCase()}` : 'series:none';
		const label = seriesLabel || 'No Series';
		const existing = groupById.get(id);
		if (existing) {
			existing.books.push(book);
			continue;
		}

		const group: LibraryBookGroup = {
			id,
			label,
			books: [book]
		};
		groupById.set(id, group);
		groups.push(group);
	}

	return groups;
}
