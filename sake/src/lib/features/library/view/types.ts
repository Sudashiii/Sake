import type { LibraryBook } from '$lib/types/Library/Book';

export type LibrarySortField =
	| 'dateAdded'
	| 'title'
	| 'author'
	| 'series'
	| 'publishedDate'
	| 'progressUpdated';
export type LibrarySortDirection = 'asc' | 'desc';
export interface LibrarySortPreference {
	field: LibrarySortField;
	direction: LibrarySortDirection;
}
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
export const DEFAULT_LIBRARY_SORT_PREFERENCE: LibrarySortPreference = {
	field: 'dateAdded',
	direction: 'desc'
};

export const LIBRARY_SORT_FIELD_OPTIONS = [
	{ value: 'dateAdded', label: 'Date Added' },
	{ value: 'title', label: 'Title' },
	{ value: 'author', label: 'Author' },
	{ value: 'series', label: 'Series' },
	{ value: 'publishedDate', label: 'Date Published' },
	{ value: 'progressUpdated', label: 'Progress Updated' }
] as const satisfies ReadonlyArray<{ value: LibrarySortField; label: string }>;

export const LIBRARY_SORT_DIRECTION_OPTIONS = [
	{ value: 'asc', label: 'Asc' },
	{ value: 'desc', label: 'Desc' }
] as const satisfies ReadonlyArray<{ value: LibrarySortDirection; label: string }>;

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
	month: string;
	day: string;
	googleBooksId: string;
	openLibraryKey: string;
	amazonAsin: string;
	externalRating: string;
	externalRatingCount: string;
};
