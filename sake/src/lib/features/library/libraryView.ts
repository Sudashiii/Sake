import type { BookProgressHistoryEntry } from '$lib/types/Library/BookProgressHistory';
import type { LibraryBook } from '$lib/types/Library/Book';
import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
import type { LibraryShelf } from '$lib/types/Library/Shelf';
import type { RuleGroup, RuleNode, ShelfCondition } from '$lib/types/Library/ShelfRule';

export type LibrarySort = 'dateAdded' | 'titleAsc' | 'progressRecent' | 'series';
export type LibraryView = 'library' | 'archived' | 'trash';
export type LibraryStatusFilter = 'all' | 'unread' | 'reading' | 'read';
export type LibraryVisualMode = 'grid' | 'list';
export type DetailTab = 'overview' | 'progress' | 'metadata' | 'devices';
export type LibraryBulkShelfAction = 'add' | 'remove';
export interface LibraryBookGroup {
	id: string;
	label: string;
	books: LibraryBook[];
}

export const LIBRARY_SELECTION_LONG_PRESS_MS = 360;
export const LIBRARY_SELECTION_PRESS_CANCEL_DISTANCE_PX = 8;
export const LEGACY_LIBRARY_SORT_STORAGE_KEY = 'librarySort';
export const ROOT_LIBRARY_SORT_STORAGE_KEY = 'librarySort:library';

export type MetadataDraft = {
	title: string;
	author: string;
	publisher: string;
	series: string;
	volume: string;
	seriesIndex: string;
	edition: string;
	identifier: string;
	pages: string;
	description: string;
	cover: string;
	language: string;
	year: string;
	googleBooksId: string;
	openLibraryKey: string;
	amazonAsin: string;
	externalRating: string;
	externalRatingCount: string;
};

const MANAGED_COVER_ROUTE_PREFIX = '/api/library/covers/';

export function parseViewFromUrl(value: string | null): LibraryView | null {
	if (value === 'library' || value === 'archived' || value === 'trash') {
		return value;
	}
	return null;
}

export function isLibrarySort(value: string | null | undefined): value is LibrarySort {
	return (
		value === 'dateAdded' ||
		value === 'titleAsc' ||
		value === 'progressRecent' ||
		value === 'series'
	);
}

export function getLibrarySortStorageKey(shelfId: number | null): string {
	return shelfId === null
		? ROOT_LIBRARY_SORT_STORAGE_KEY
		: `${ROOT_LIBRARY_SORT_STORAGE_KEY}:shelf:${shelfId}`;
}

export function readStoredLibrarySort(
	storage: Pick<Storage, 'getItem'>,
	shelfId: number | null
): LibrarySort | null {
	const candidateKeys =
		shelfId === null
			? [ROOT_LIBRARY_SORT_STORAGE_KEY, LEGACY_LIBRARY_SORT_STORAGE_KEY]
			: [
					getLibrarySortStorageKey(shelfId),
					ROOT_LIBRARY_SORT_STORAGE_KEY,
					LEGACY_LIBRARY_SORT_STORAGE_KEY
				];

	for (const key of candidateKeys) {
		const stored = storage.getItem(key);
		if (isLibrarySort(stored)) {
			return stored;
		}
	}

	return null;
}

export function writeStoredLibrarySort(
	storage: Pick<Storage, 'setItem'>,
	shelfId: number | null,
	sort: LibrarySort
): void {
	storage.setItem(getLibrarySortStorageKey(shelfId), sort);
}

export function toDraftText(value: string | number | null | undefined): string {
	return value === null || value === undefined ? '' : String(value);
}

export function isManagedLibraryCoverUrl(value: string | null | undefined): boolean {
	return typeof value === 'string' && value.startsWith(MANAGED_COVER_ROUTE_PREFIX);
}

export function isImportableExternalCoverUrl(value: string | null | undefined): boolean {
	if (typeof value !== 'string') {
		return false;
	}

	const trimmed = value.trim();
	if (!trimmed || isManagedLibraryCoverUrl(trimmed)) {
		return false;
	}

	try {
		const url = trimmed.startsWith('//') ? new URL(`https:${trimmed}`) : new URL(trimmed);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

export function parseNullableNumber(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

export function formatFileSize(bytes: number | null): string {
	if (!bytes || bytes <= 0) {
		return 'Unknown size';
	}
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string | null): string {
	if (!dateStr) {
		return 'Unknown';
	}
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium'
	}).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(dateStr));
}

export function normalizeText(value: string | null | undefined): string {
	return value?.toLowerCase().trim() ?? '';
}

export function toggleBookSelection(selectedBookIds: number[], bookId: number): number[] {
	if (selectedBookIds.includes(bookId)) {
		return selectedBookIds.filter((id) => id !== bookId);
	}

	return [...selectedBookIds, bookId].sort((a, b) => a - b);
}

export function getVisibleBookIds(books: LibraryBook[]): number[] {
	return books.map((book) => book.id).sort((a, b) => a - b);
}

export function pruneBookSelection(selectedBookIds: number[], visibleBookIds: number[]): number[] {
	const visibleIdSet = new Set(visibleBookIds);
	return selectedBookIds.filter((id) => visibleIdSet.has(id)).sort((a, b) => a - b);
}

export function applyBulkShelfSelection(
	currentShelfIds: number[],
	shelfId: number,
	action: LibraryBulkShelfAction
): number[] {
	const uniqueShelfIds = [...new Set(currentShelfIds)];
	if (action === 'add') {
		return uniqueShelfIds.includes(shelfId)
			? uniqueShelfIds.sort((a, b) => a - b)
			: [...uniqueShelfIds, shelfId].sort((a, b) => a - b);
	}

	return uniqueShelfIds.filter((id) => id !== shelfId).sort((a, b) => a - b);
}

export function matchesBookQuery(book: LibraryBook, query: string): boolean {
	const normalizedQuery = normalizeText(query);
	if (!normalizedQuery) {
		return true;
	}

	return [book.title, book.author, book.series, book.volume, book.extension, book.language, book.series_index]
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

export function getRuleFieldValue(book: LibraryBook, field: ShelfCondition['field']): string | number | null {
	if (field === 'title') return book.title;
	if (field === 'author') return book.author ?? null;
	if (field === 'series') return book.series ?? null;
	if (field === 'format') return book.extension ?? null;
	if (field === 'language') return book.language ?? null;
	if (field === 'status') return getBookStatus(book);
	if (field === 'seriesIndex') return book.series_index ?? null;
	if (field === 'rating') return book.rating;
	if (field === 'readingProgress') return getProgressPercent(book);
	if (field === 'year') return book.year ?? null;
	if (field === 'pages') return book.pages ?? null;
	return null;
}

export function evaluateCondition(book: LibraryBook, condition: ShelfCondition): boolean {
	const raw = getRuleFieldValue(book, condition.field);
	if (raw === null || raw === undefined) {
		return false;
	}

	const bookString = String(raw).toLowerCase();
	const ruleString = condition.value.toLowerCase();
	const bookNumber = Number(raw);
	const ruleNumber = Number(condition.value);
	const isNumeric = !Number.isNaN(bookNumber) && !Number.isNaN(ruleNumber);

	if (condition.operator === 'equals') {
		return isNumeric ? bookNumber === ruleNumber : bookString === ruleString;
	}
	if (condition.operator === 'not_equals') {
		return isNumeric ? bookNumber !== ruleNumber : bookString !== ruleString;
	}
	if (condition.operator === 'contains') {
		return bookString.includes(ruleString);
	}
	if (condition.operator === 'not_contains') {
		return !bookString.includes(ruleString);
	}
	if (condition.operator === 'gt') {
		return isNumeric && bookNumber > ruleNumber;
	}
	if (condition.operator === 'lt') {
		return isNumeric && bookNumber < ruleNumber;
	}
	if (condition.operator === 'gte') {
		return isNumeric && bookNumber >= ruleNumber;
	}
	if (condition.operator === 'lte') {
		return isNumeric && bookNumber <= ruleNumber;
	}

	return false;
}

export function evaluateRuleNode(book: LibraryBook, node: RuleNode): boolean {
	if (node.type === 'condition') {
		return evaluateCondition(book, node);
	}
	if (node.children.length === 0) {
		return false;
	}
	if (node.connector === 'AND') {
		return node.children.every((child) => evaluateRuleNode(book, child));
	}
	return node.children.some((child) => evaluateRuleNode(book, child));
}

export function evaluateRuleGroup(book: LibraryBook, group: RuleGroup): boolean {
	if (group.children.length === 0) {
		return false;
	}
	return evaluateRuleNode(book, group);
}

export function matchesBookShelf(
	book: LibraryBook,
	shelfId: number | null,
	shelvesById?: Map<number, LibraryShelf>
): boolean {
	if (shelfId === null) {
		return true;
	}

	const manualMatch = book.shelfIds.includes(shelfId);
	const shelf = shelvesById?.get(shelfId);
	if (!shelf) {
		return manualMatch;
	}

	const rulesMatch =
		shelf.ruleGroup.children.length > 0 ? evaluateRuleGroup(book, shelf.ruleGroup) : false;
	return manualMatch || rulesMatch;
}

export function getDetailStatusLabel(detail: LibraryBookDetail): 'Unread' | 'Reading' | 'Read' {
	const progress = clampProgress(detail.progressPercent);
	if (progress >= 99.95 || detail.isRead) {
		return 'Read';
	}
	if (progress > 0) {
		return 'Reading';
	}
	return 'Unread';
}

export function getDetailStatusClass(detail: LibraryBookDetail): 'read' | 'reading' | 'unread' {
	const label = getDetailStatusLabel(detail);
	return label === 'Read' ? 'read' : label === 'Reading' ? 'reading' : 'unread';
}

export function clampProgress(value: number | null | undefined): number {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return 0;
	}
	return Math.min(100, Math.max(0, value));
}

export function getFormatBadgeClass(extension: string | null): string {
	const normalized = normalizeText(extension);
	if (normalized === 'pdf') {
		return 'pdf';
	}
	if (normalized === 'mobi') {
		return 'mobi';
	}
	return 'epub';
}

export function getRoundedRating(rating: number | null | undefined): number {
	if (rating === null || rating === undefined || Number.isNaN(rating)) {
		return 0;
	}
	return Math.max(0, Math.min(5, Math.round(rating)));
}

export function toGoogleBooksUrl(googleBooksId: string): string {
	return `https://books.google.com/books?id=${encodeURIComponent(googleBooksId)}`;
}

export function toOpenLibraryUrl(openLibraryKey: string): string {
	return `https://openlibrary.org${openLibraryKey.startsWith('/') ? openLibraryKey : `/${openLibraryKey}`}`;
}

export function getCurrentPage(progressPercent: number | null, pages: number | null): number | null {
	if (progressPercent === null || pages === null || pages <= 0) {
		return null;
	}
	const progress = clampProgress(progressPercent);
	if (progress <= 0) {
		return 0;
	}
	const currentPage = Math.round((progress / 100) * pages);
	return Math.max(1, Math.min(pages, currentPage));
}

export function getProgressHistoryPageRange(
	history: BookProgressHistoryEntry[],
	index: number,
	pages: number | null
): string | null {
	if (pages === null || pages <= 0) {
		return null;
	}
	const currentEntry = history[index];
	if (!currentEntry) {
		return null;
	}
	const nextNewerEntry = history[index + 1];
	const fromPercent = nextNewerEntry ? clampProgress(nextNewerEntry.progressPercent) : 0;
	const toPercent = clampProgress(currentEntry.progressPercent);
	const fromPage = Math.round((fromPercent / 100) * pages);
	const toPage = Math.round((toPercent / 100) * pages);
	const normalizedFromPage = Math.max(0, Math.min(pages, fromPage));
	const normalizedToPage = Math.max(0, Math.min(pages, toPage));
	if (normalizedToPage <= normalizedFromPage) {
		return null;
	}
	return `Read from page ${normalizedFromPage} to ${normalizedToPage}`;
}

export function getSortLabel(value: LibrarySort): string {
	if (value === 'series') {
		return 'Series';
	}
	if (value === 'titleAsc') {
		return 'Title A-Z';
	}
	if (value === 'progressRecent') {
		return 'Recent Progress';
	}
	return 'Date Added';
}

export function getFilterLabel(currentView: LibraryView, statusFilter: LibraryStatusFilter): string {
	if (currentView === 'archived') {
		return 'Archived';
	}
	if (currentView === 'trash') {
		return 'Trash';
	}
	if (statusFilter === 'unread') {
		return 'Unread';
	}
	if (statusFilter === 'reading') {
		return 'Reading';
	}
	if (statusFilter === 'read') {
		return 'Read';
	}
	return 'All';
}

export function sortBooks(list: LibraryBook[], mode: LibrarySort): LibraryBook[] {
	const copy = [...list];
	if (mode === 'series') {
		return copy.sort(compareBooksBySeries);
	}
	if (mode === 'titleAsc') {
		return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	}
	if (mode === 'progressRecent') {
		return copy.sort((a, b) => {
			const aTime = a.progress_updated_at ? Date.parse(a.progress_updated_at) : 0;
			const bTime = b.progress_updated_at ? Date.parse(b.progress_updated_at) : 0;
			return bTime - aTime;
		});
	}
	return copy.sort((a, b) => {
		const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
		const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
		return bTime - aTime;
	});
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

function compareSeriesNames(left: LibraryBook, right: LibraryBook): number {
	const leftSeries = normalizeSeriesLabel(left.series);
	const rightSeries = normalizeSeriesLabel(right.series);
	if (!leftSeries && !rightSeries) {
		return 0;
	}
	if (!leftSeries) {
		return 1;
	}
	if (!rightSeries) {
		return -1;
	}
	return compareLabel(leftSeries, rightSeries);
}

function compareSeriesIndices(left: LibraryBook, right: LibraryBook): number {
	const leftValue =
		typeof left.series_index === 'number' && Number.isFinite(left.series_index)
			? left.series_index
			: null;
	const rightValue =
		typeof right.series_index === 'number' && Number.isFinite(right.series_index)
			? right.series_index
			: null;

	if (leftValue === null && rightValue === null) {
		return 0;
	}
	if (leftValue === null) {
		return 1;
	}
	if (rightValue === null) {
		return -1;
	}
	return leftValue - rightValue;
}

function compareBooksBySeries(left: LibraryBook, right: LibraryBook): number {
	const seriesCompare = compareSeriesNames(left, right);
	if (seriesCompare !== 0) {
		return seriesCompare;
	}

	const sameSeries = normalizeSeriesLabel(left.series).length > 0;
	if (!sameSeries) {
		return compareLabel(left.title, right.title);
	}

	const seriesIndexCompare = compareSeriesIndices(left, right);
	if (seriesIndexCompare !== 0) {
		return seriesIndexCompare;
	}

	const volumeCompare = compareLabel(normalizeText(left.volume), normalizeText(right.volume));
	if (volumeCompare !== 0) {
		return volumeCompare;
	}

	return compareLabel(left.title, right.title);
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
