import type { RequestHandler } from '@sveltejs/kit';
import { requireBasicAuth } from '../../auth';
import { getLibraryFileUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async (event) => {
	const authResponse = await requireBasicAuth(event);
	if (authResponse) return authResponse;

	const { params, locals } = event;
	const requestLogger = getRequestLogger(locals);
	const title = params.title;
	
	if (!title) {
		requestLogger.warn({ event: 'opds.file.fetch.validation_failed' }, 'Missing title parameter');
		return errorResponse('Missing title parameter', 400);
	}

	try {
		const result = await getLibraryFileUseCase.execute(title);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'opds.file.fetch.use_case_failed',
					title,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch library file rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(result.value.data, {
			headers: {
				'Content-Type': result.value.contentType,
				'Content-Length': result.value.contentLength.toString()
			}
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'opds.file.fetch.failed', error: toLogError(err), title }, 'Fetch library file failed');
		return errorResponse('File not found', 404);
	}
};
