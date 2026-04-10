import type { RequestHandler } from '@sveltejs/kit';
import { requireBasicAuth } from '../../auth';
import { getLibraryCoverUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async (event) => {
	const authResponse = await requireBasicAuth(event);
	if (authResponse) return authResponse;

	const { params, locals } = event;
	const requestLogger = getRequestLogger(locals);
	const fileName = params.fileName;
	
	if (!fileName) {
		requestLogger.warn({ event: 'opds.cover.fetch.validation_failed' }, 'Missing file name parameter');
		return errorResponse('Missing file name parameter', 400);
	}

	try {
		const result = await getLibraryCoverUseCase.execute(fileName);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'opds.cover.fetch.use_case_failed',
					fileName,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch library cover rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(result.value.data, {
			headers: {
				'Cache-Control': result.value.cacheControl,
				'Content-Length': result.value.contentLength.toString(),
				'Content-Type': result.value.contentType
			}
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'opds.cover.fetch.failed', error: toLogError(err), fileName },
			'Fetch library cover failed'
		);
		return errorResponse('Cover not found', 404);
	}
};
