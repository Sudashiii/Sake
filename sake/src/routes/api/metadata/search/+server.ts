import { searchMetadataCandidatesUseCase } from '$lib/server/application/composition';
import { isMetadataLookupEnabled } from '$lib/server/config/activatedMetadataProviders';
import type { MetadataQuery } from '$lib/server/application/ports/MetadataProviderPort';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function str(v: unknown): string | null {
	return typeof v === 'string' ? v : null;
}

function parseQuery(raw: unknown): MetadataQuery | undefined {
	if (raw == null || typeof raw !== 'object') return undefined;
	const r = raw as Record<string, unknown>;
	return {
		title: str(r.title),
		author: str(r.author),
		isbn: str(r.isbn),
		language: str(r.language),
		googleBooksId: str(r.googleBooksId),
		openLibraryKey: str(r.openLibraryKey),
		hardcoverId: str(r.hardcoverId),
		limit: typeof r.limit === 'number' ? r.limit : undefined
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isMetadataLookupEnabled()) {
		return errorResponse('Metadata lookup is not enabled', 404);
	}

	const requestLogger = getRequestLogger(locals);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON body', 400);
	}

	const bookId = typeof body.bookId === 'number' ? body.bookId : undefined;
	const query = parseQuery(body.query);

	try {
		const result = await searchMetadataCandidatesUseCase.execute({ bookId, query });
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
