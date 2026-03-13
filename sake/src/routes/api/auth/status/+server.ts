import { getAuthStatusUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);

	try {
		const result = await getAuthStatusUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.status.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch auth status rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.status.failed', error: toLogError(err) }, 'Failed to fetch auth status');
		return errorResponse('Failed to fetch auth status', 500);
	}
};
