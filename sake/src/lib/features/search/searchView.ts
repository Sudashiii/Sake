import type { SearchProviderId } from '$lib/types/Search/Provider';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';

export const SEARCH_PROVIDER_STORAGE_KEY = 'sake.search.providers';
export const SEARCH_PROVIDER_COLLAPSE_STORAGE_KEY = 'sake.search.provider-groups.collapsed';

export const SEARCH_PROVIDER_OPTIONS = [
	{ value: 'zlibrary', label: 'Z-Library' },
	{ value: 'anna', label: "Anna's Archive" },
	{ value: 'openlibrary', label: 'OpenLibrary' },
	{ value: 'gutenberg', label: 'Gutenberg' }
] as const;

export const SEARCH_LANGUAGE_OPTIONS = [
	{ value: 'english', label: 'English' },
	{ value: 'german', label: 'German' },
	{ value: 'french', label: 'French' },
	{ value: 'spanish', label: 'Spanish' }
] as const;

export const SEARCH_FORMAT_OPTIONS = [
	{ value: 'epub', label: 'epub' },
	{ value: 'mobi', label: 'mobi' },
	{ value: 'pdf', label: 'pdf' }
] as const;

export const SEARCH_SORT_OPTIONS = [
	{ value: 'relevance', label: 'Relevance' },
	{ value: 'title_asc', label: 'Title A-Z' },
	{ value: 'year_desc', label: 'Year (newest)' },
	{ value: 'year_asc', label: 'Year (oldest)' }
] as const;

export type SearchSortValue = SearchBooksRequest['sort'];

export function getActiveProviderOptions(
	activeProviderIds: SearchProviderId[]
): Array<(typeof SEARCH_PROVIDER_OPTIONS)[number]> {
	const activeProviderSet = new Set(activeProviderIds);
	return SEARCH_PROVIDER_OPTIONS.filter((option) =>
		activeProviderSet.has(option.value as SearchProviderId)
	);
}

export function getDefaultSelectedProviders(
	activeProviderIds: SearchProviderId[]
): SearchProviderId[] {
	if (activeProviderIds.includes('zlibrary')) {
		return ['zlibrary'];
	}

	return activeProviderIds[0] ? [activeProviderIds[0]] : [];
}

export function emptyCollapsedProviderGroups(): Record<SearchProviderId, boolean> {
	return {
		zlibrary: false,
		anna: false,
		openlibrary: false,
		gutenberg: false
	};
}

export function getBookCacheKey(provider: SearchProviderId, providerBookId: string): string {
	return `${provider}:${providerBookId}`;
}

export function providerLabel(providerId: SearchProviderId): string {
	if (providerId === 'zlibrary') {
		return 'Z-Library';
	}
	if (providerId === 'anna') {
		return "Anna's Archive";
	}
	if (providerId === 'openlibrary') {
		return 'OpenLibrary';
	}
	return 'Gutenberg';
}

export function formatFileSize(sizeInBytes: number | null): string {
	if (typeof sizeInBytes !== 'number' || !Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
		return 'Not available';
	}

	if (sizeInBytes < 1024) {
		return `${sizeInBytes} B`;
	}
	if (sizeInBytes < 1024 * 1024) {
		return `${Math.round(sizeInBytes / 1024)} KB`;
	}
	return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseYearInput(value: string | number | null | undefined): number | undefined {
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || value < 0) {
			return undefined;
		}
		return Math.trunc(value);
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return undefined;
	}
	return parsed;
}

export function isProviderId(value: string): value is SearchProviderId {
	return (
		value === 'zlibrary' ||
		value === 'anna' ||
		value === 'openlibrary' ||
		value === 'gutenberg'
	);
}

export function normalizeProviderSelection(
	nextValues: string[],
	activeProviderIds: SearchProviderId[]
): SearchProviderId[] {
	const activeProviderSet = new Set(activeProviderIds);
	const normalized = nextValues.filter(
		(entry): entry is SearchProviderId => isProviderId(entry) && activeProviderSet.has(entry)
	);
	return normalized.length > 0 ? [...new Set(normalized)] : getDefaultSelectedProviders(activeProviderIds);
}

export function normalizeStringSelection(nextValues: string[]): string[] {
	return [...new Set(nextValues)];
}

export function loadStoredProviders(
	storage: Storage | undefined,
	activeProviderIds: SearchProviderId[]
): SearchProviderId[] | null {
	if (!storage) {
		return null;
	}

	const raw = storage.getItem(SEARCH_PROVIDER_STORAGE_KEY);
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return null;
		}
		const activeProviderSet = new Set(activeProviderIds);
		const validProviders = parsed
			.map((entry) => String(entry))
			.filter(
				(entry): entry is SearchProviderId => isProviderId(entry) && activeProviderSet.has(entry)
			);
		return validProviders.length > 0 ? [...new Set(validProviders)] : null;
	} catch {
		return null;
	}
}

export function loadStoredCollapsedProviderGroups(
	storage: Storage | undefined
): Record<SearchProviderId, boolean> | null {
	if (!storage) {
		return null;
	}

	const raw = storage.getItem(SEARCH_PROVIDER_COLLAPSE_STORAGE_KEY);
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return null;
		}
		const value = parsed as Record<string, unknown>;
		return {
			zlibrary: value.zlibrary === true,
			anna: value.anna === true,
			openlibrary: value.openlibrary === true,
			gutenberg: value.gutenberg === true
		};
	} catch {
		return null;
	}
}

export function persistSelectedProviders(
	storage: Storage | undefined,
	selectedProviders: SearchProviderId[]
): void {
	storage?.setItem(SEARCH_PROVIDER_STORAGE_KEY, JSON.stringify(selectedProviders));
}

export function persistCollapsedProviderGroups(
	storage: Storage | undefined,
	collapsedProviderGroups: Record<SearchProviderId, boolean>
): void {
	storage?.setItem(
		SEARCH_PROVIDER_COLLAPSE_STORAGE_KEY,
		JSON.stringify(collapsedProviderGroups)
	);
}

export function toggleProviderGroupState(
	current: Record<SearchProviderId, boolean>,
	providerId: SearchProviderId
): Record<SearchProviderId, boolean> {
	return {
		...current,
		[providerId]: !(current[providerId] ?? false)
	};
}

export function displayValue(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return 'Not available';
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : 'Not available';
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : 'Not available';
}

export function toGoogleBooksUrl(googleBooksId: string | null | undefined): string | null {
	const id = googleBooksId?.trim();
	if (!id) {
		return null;
	}
	return `https://books.google.com/books?id=${encodeURIComponent(id)}`;
}

export function toOpenLibraryUrl(openLibraryKey: string | null | undefined): string | null {
	const key = openLibraryKey?.trim();
	if (!key) {
		return null;
	}
	const normalized = key.startsWith('/') ? key : `/${key}`;
	return `https://openlibrary.org${normalized}`;
}
