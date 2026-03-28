import { type SearchProviderId } from '$lib/types/Search/Provider';

const PROVIDER_ALIASES: Record<string, SearchProviderId> = {
	zlib: 'zlibrary',
	zlibrary: 'zlibrary',
	anna: 'anna',
	annas: 'anna',
	'annas-archive': 'anna',
	annasarchive: 'anna',
	openlib: 'openlibrary',
	openlibrary: 'openlibrary',
	gutenberg: 'gutenberg'
};

const SEARCH_API_PREFIXES = ['/api/search', '/api/zlibrary/search'] as const;

function normalizeProviderToken(value: string): SearchProviderId | null {
	const normalized = value.trim().toLowerCase();
	if (!normalized) {
		return null;
	}

	return PROVIDER_ALIASES[normalized] ?? null;
}

export function parseActivatedSearchProviders(
	rawValue: string | undefined | null
): SearchProviderId[] {
	if (rawValue === undefined || rawValue === null) {
		return [];
	}

	const parsed = rawValue
		.split(',')
		.map((entry) => normalizeProviderToken(entry))
		.filter((entry): entry is SearchProviderId => entry !== null);

	return [...new Set(parsed)];
}

export function isSearchFeatureApiPath(pathname: string): boolean {
	return SEARCH_API_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}
