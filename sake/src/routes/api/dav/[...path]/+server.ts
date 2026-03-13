import type { RequestHandler } from '@sveltejs/kit';
import { listDavDirectoryUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

// -------------------------------
// PROPFIND /api/dav/*path
// -------------------------------
export const fallback: RequestHandler = async ({ request, url, locals }) => {
	const requestLogger = getRequestLogger(locals);
	if (request.method !== 'PROPFIND') {
		requestLogger.warn({ event: 'dav.propfind.method_not_allowed', method: request.method }, 'Method not allowed');
		return errorResponse('Method not allowed', 405);
	}

	try {
		const rawPath = url.pathname.replace(/^\/api\/dav\/?/, '');
		const result = await listDavDirectoryUseCase.execute({ path: rawPath });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'dav.propfind.use_case_failed',
					path: rawPath,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'PROPFIND rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(result.value.xml, {
			status: 207, 
			headers: {
				'Content-Type': 'application/xml; charset=utf-8'
			}
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'dav.propfind.failed', error: toLogError(err) }, 'PROPFIND error');
		return errorResponse('Failed to list directory', 500);
	}
};
