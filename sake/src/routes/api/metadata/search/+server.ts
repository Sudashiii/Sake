import {
	activatedMetadataProviders,
	searchMetadataCandidatesUseCase
} from '$lib/server/application/composition';
import type { MetadataQuery } from '$lib/server/application/ports/MetadataProviderPort';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_METADATA_SEARCH_LIMIT = 10;

function str(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	const trimmed = v.trim();
	return trimmed === '' ? null : trimmed;
}

function parsePositiveInteger(value: unknown): number | null {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseLimit(value: unknown): number | undefined {
	if (value == null) return undefined;
	const parsed = parsePositiveInteger(value);
	return parsed == null ? undefined : Math.min(parsed, MAX_METADATA_SEARCH_LIMIT);
}

function parseQuery(raw: unknown): { query?: MetadataQuery; error?: string } | undefined {
	if (raw == null || typeof raw !== 'object') return undefined;
	const r = raw as Record<string, unknown>;
	const limit = parseLimit(r.limit);
	if (r.limit != null && limit == null) {
		return { error: 'query.limit must be a positive integer' };
	}

	const query: MetadataQuery = {
		title: str(r.title),
		author: str(r.author),
		isbn: str(r.isbn),
		language: str(r.language),
		googleBooksId: str(r.googleBooksId),
		openLibraryKey: str(r.openLibraryKey),
		hardcoverId: str(r.hardcoverId)
	};
	if (limit != null) {
		query.limit = limit;
	}

	return {
		query
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (activatedMetadataProviders.length === 0) {
		return errorResponse('Metadata lookup is not enabled', 404);
	}

	const requestLogger = getRequestLogger(locals);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON body', 400);
	}

	let bookId: number | undefined;
	if (body.bookId != null) {
		const parsedBookId = parsePositiveInteger(body.bookId);
		if (parsedBookId == null) {
			return errorResponse('bookId must be a positive integer', 400);
		}
		bookId = parsedBookId;
	}

	const parsedQuery = parseQuery(body.query);
	if (parsedQuery?.error) {
		return errorResponse(parsedQuery.error, 400);
	}

	try {
		const result = await searchMetadataCandidatesUseCase.execute({
			bookId,
			query: parsedQuery?.query
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'metadata.search.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Metadata search rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'metadata.search.failed', error: toLogError(err) },
			'Metadata search failed'
		);
		return errorResponse('Metadata search failed', 500);
	}
};
