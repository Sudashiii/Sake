import { zlibrarySearchUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { ZSearchBookRequest } from '$lib/types/ZLibrary/Requests/ZSearchBookRequest';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// -------------------------------
// POST /api/zlibrary/search
// -------------------------------
export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	requestLogger.warn(
		{
			event: 'zlibrary.search.deprecated_endpoint_used',
			replacement: '/api/search'
		},
		'Deprecated endpoint /api/zlibrary/search called; use /api/search'
	);
	let body: ZSearchBookRequest;
	try {
		body = (await request.json()) as ZSearchBookRequest;
	} catch (err: unknown) {
		requestLogger.warn({ event: 'zlibrary.search.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
		return errorResponse('Invalid JSON body', 400);
	}
	if (!locals.zuser) {
		requestLogger.warn({ event: 'zlibrary.search.auth_missing' }, 'Z-Library login is not valid');
		return errorResponse('Z-Library login is not valid', 409);
	}

	try {
		const searchResult = await zlibrarySearchUseCase.execute({
			request: body,
			credentials: {
				userId: locals.zuser.userId,
				userKey: locals.zuser.userKey
			}
		});
		if (!searchResult.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.search.use_case_failed',
					statusCode: searchResult.error.status,
					reason: searchResult.error.message
				},
				'Search rejected'
			);
			return errorResponse(searchResult.error.message, searchResult.error.status);
		}

		return json(searchResult.value, {
			headers: {
				Deprecation: 'true',
				Link: '</api/search>; rel="successor-version"'
			}
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'zlibrary.search.failed', error: toLogError(err) }, 'Search failed');
		return errorResponse('Search failed', 500);
	}
};
