import { searchBooksUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { SEARCH_PROVIDER_IDS, type SearchProviderId } from '$lib/types/Search/Provider';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

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

function parseRequest(raw: unknown): SearchBooksRequest {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}

	const queryRaw = raw.query;
	if (typeof queryRaw !== 'string' || queryRaw.trim().length === 0) {
		throw new Error('query is required');
	}

	let providers: SearchProviderId[] = ['zlibrary'];
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
		providers,
		filters,
		sort
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);

	let parsedRequest: SearchBooksRequest;
	try {
		const raw = await request.json();
		parsedRequest = parseRequest(raw);
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'search.invalid_payload', error: toLogError(err) },
			'Search payload validation failed'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid JSON body', 400);
	}

	try {
		const result = await searchBooksUseCase.execute({
			request: parsedRequest,
			context: {
				zlibraryCredentials: locals.zuser
					? { userId: locals.zuser.userId, userKey: locals.zuser.userKey }
					: null
			}
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'search.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Search rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'search.failed', error: toLogError(err) }, 'Search failed');
		return errorResponse('Search failed', 500);
	}
};
