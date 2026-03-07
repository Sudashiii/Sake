import { listActiveApiKeysUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);

	if (locals.auth?.type !== 'session') {
		return errorResponse('Authentication required', 401);
	}

	try {
		const result = await listActiveApiKeysUseCase.execute({
			userId: locals.auth.user.id
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.api_keys.list.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'List API keys rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.api_keys.list.failed', error: toLogError(err) }, 'Failed to list API keys');
		return errorResponse('Failed to list API keys', 500);
	}
};
