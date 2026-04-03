import type { BookProgressHistoryEntry } from '$lib/types/Library/BookProgressHistory';
import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
import { formatPublicationDate } from '$lib/utils/publicationDate';
import {
	LIBRARY_SORT_FIELD_OPTIONS,
	type LibrarySortDirection,
	type LibrarySortField,
	type LibraryStatusFilter,
	type LibraryView
} from './types';

const MANAGED_COVER_ROUTE_PREFIX = '/api/library/covers/';

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

export function toDateTimeLocalInputValue(dateStr: string | null | undefined): string {
	if (!dateStr) {
		return '';
	}

	const date = new Date(dateStr);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return localDate.toISOString().slice(0, 16);
}

export function parseDateTimeLocalInputValue(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const date = new Date(trimmed);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatLibraryPublicationDate(parts: {
	year: number | null | undefined;
	month: number | null | undefined;
	day: number | null | undefined;
}): string {
	return (
		formatPublicationDate({
			year: parts.year ?? null,
			month: parts.month ?? null,
			day: parts.day ?? null
		}) ?? '—'
	);
}

export function normalizeText(value: string | null | undefined): string {
	return value?.toLowerCase().trim() ?? '';
}

export function clampProgress(value: number | null | undefined): number {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return 0;
	}
	return Math.min(100, Math.max(0, value));
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

export function getSortFieldLabel(value: LibrarySortField): string {
	return LIBRARY_SORT_FIELD_OPTIONS.find((option) => option.value === value)?.label ?? 'Date Added';
}

export function getSortDirectionLabel(value: LibrarySortDirection): string {
	return value === 'asc' ? 'Asc' : 'Desc';
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
