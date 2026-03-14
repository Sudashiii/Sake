import { isAuthenticationFailureStatus } from '$lib/auth/responseSignals';
import { zlibraryAuthFailureResponse } from '$lib/server/auth/responseSignals';
import { searchBooksUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { parseSearchBooksRequest } from '$lib/server/http/searchBooksRequest';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals, cookies, url }) => {
	const requestLogger = getRequestLogger(locals);

	let parsedRequest: SearchBooksRequest;
	try {
		const raw = await request.json();
		parsedRequest = parseSearchBooksRequest(raw);
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
			if (locals.zuser && isAuthenticationFailureStatus(result.error.status)) {
				return zlibraryAuthFailureResponse(result.error.message, result.error.status, cookies, url);
			}
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'search.failed', error: toLogError(err) }, 'Search failed');
		return errorResponse('Search failed', 500);
	}
};
