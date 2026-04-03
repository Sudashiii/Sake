import {
	LEGACY_LIBRARY_SORT_STORAGE_KEY,
	ROOT_LIBRARY_SORT_STORAGE_KEY,
	type LibrarySortDirection,
	type LibrarySortField,
	type LibrarySortPreference,
	type LibraryView
} from './types';

type LegacyLibrarySort = 'dateAdded' | 'titleAsc' | 'progressRecent' | 'series';

export function parseViewFromUrl(value: string | null): LibraryView | null {
	if (value === 'library' || value === 'archived' || value === 'trash') {
		return value;
	}
	return null;
}

export function isLibrarySortField(value: string | null | undefined): value is LibrarySortField {
	return (
		value === 'dateAdded' ||
		value === 'title' ||
		value === 'author' ||
		value === 'series' ||
		value === 'publishedDate' ||
		value === 'progressUpdated'
	);
}

export function isLibrarySortDirection(
	value: string | null | undefined
): value is LibrarySortDirection {
	return value === 'asc' || value === 'desc';
}

function isLegacyLibrarySort(value: string | null | undefined): value is LegacyLibrarySort {
	return (
		value === 'dateAdded' ||
		value === 'titleAsc' ||
		value === 'progressRecent' ||
		value === 'series'
	);
}

function mapLegacyLibrarySort(value: LegacyLibrarySort): LibrarySortPreference {
	if (value === 'titleAsc') {
		return { field: 'title', direction: 'asc' };
	}
	if (value === 'progressRecent') {
		return { field: 'progressUpdated', direction: 'desc' };
	}
	if (value === 'series') {
		return { field: 'series', direction: 'asc' };
	}
	return { field: 'dateAdded', direction: 'desc' };
}

function parseStoredLibrarySort(value: string | null | undefined): LibrarySortPreference | null {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (isLegacyLibrarySort(trimmed)) {
		return mapLegacyLibrarySort(trimmed);
	}

	const [field, direction, extra] = trimmed.split(':');
	if (extra !== undefined) {
		return null;
	}

	if (field === 'publishedYear' && isLibrarySortDirection(direction)) {
		return { field: 'publishedDate', direction };
	}

	if (!isLibrarySortField(field) || !isLibrarySortDirection(direction)) {
		return null;
	}

	return { field, direction };
}

export function serializeLibrarySortPreference(sort: LibrarySortPreference): string {
	return `${sort.field}:${sort.direction}`;
}

export function getLibrarySortStorageKey(shelfId: number | null): string {
	return shelfId === null
		? ROOT_LIBRARY_SORT_STORAGE_KEY
		: `${ROOT_LIBRARY_SORT_STORAGE_KEY}:shelf:${shelfId}`;
}

export function readStoredLibrarySort(
	storage: Pick<Storage, 'getItem'>,
	shelfId: number | null
): LibrarySortPreference | null {
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
		const parsed = parseStoredLibrarySort(stored);
		if (parsed) {
			return parsed;
		}
	}

	return null;
}

export function writeStoredLibrarySort(
	storage: Pick<Storage, 'setItem'>,
	shelfId: number | null,
	sort: LibrarySortPreference
): void {
	storage.setItem(getLibrarySortStorageKey(shelfId), serializeLibrarySortPreference(sort));
}
