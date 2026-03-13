import { SEARCH_PROVIDER_IDS, type SearchProviderId } from '$lib/types/Search/Provider';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProviderId(value: string): value is SearchProviderId {
	return (SEARCH_PROVIDER_IDS as readonly string[]).includes(value);
}

function parseStringArray(value: unknown, field: string): string[] {
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
		throw new Error(`${field} must be an array of strings`);
	}
	return value;
}

function parseOptionalNumber(value: unknown, field: string): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${field} must be a number`);
	}
	return value;
}

export function parseSearchBooksRequest(raw: unknown): SearchBooksRequest {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}

	const queryRaw = raw.query;
	if (typeof queryRaw !== 'string' || queryRaw.trim().length === 0) {
		throw new Error('query is required');
	}

	let providers: SearchProviderId[] | undefined;
	if (raw.providers !== undefined) {
		const parsedProviders = parseStringArray(raw.providers, 'providers');
		if (parsedProviders.length === 0) {
			throw new Error('providers must not be empty');
		}

		const invalidProviders = parsedProviders.filter((provider) => !isProviderId(provider));
		if (invalidProviders.length > 0) {
			throw new Error(`Unknown providers: ${invalidProviders.join(', ')}`);
		}

		providers = parsedProviders as SearchProviderId[];
	}

	let filters: SearchBooksRequest['filters'] | undefined;
	if (raw.filters !== undefined) {
		if (!isRecord(raw.filters)) {
			throw new Error('filters must be an object');
		}

		filters = {
			language:
				raw.filters.language !== undefined
					? parseStringArray(raw.filters.language, 'filters.language')
					: undefined,
			extension:
				raw.filters.extension !== undefined
					? parseStringArray(raw.filters.extension, 'filters.extension')
					: undefined,
			yearFrom: parseOptionalNumber(raw.filters.yearFrom, 'filters.yearFrom'),
			yearTo: parseOptionalNumber(raw.filters.yearTo, 'filters.yearTo'),
			limitPerProvider: parseOptionalNumber(raw.filters.limitPerProvider, 'filters.limitPerProvider')
		};
	}

	const sort = raw.sort;
	if (
		sort !== undefined &&
		sort !== 'relevance' &&
		sort !== 'year_desc' &&
		sort !== 'year_asc' &&
		sort !== 'title_asc'
	) {
		throw new Error('sort must be one of: relevance, year_desc, year_asc, title_asc');
	}

	return {
		query: queryRaw,
		...(providers ? { providers } : {}),
		filters,
		sort
	};
}
