import { revokeApiKeyUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const requestLogger = getRequestLogger(locals);

	if (locals.auth?.type !== 'session') {
		return errorResponse('Authentication required', 401);
	}

	const apiKeyId = Number.parseInt(params.id, 10);
	if (!Number.isInteger(apiKeyId) || apiKeyId <= 0) {
		return errorResponse('Invalid API key id', 400);
	}

	try {
		const result = await revokeApiKeyUseCase.execute({
			userId: locals.auth.user.id,
			apiKeyId
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.api_keys.revoke.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message,
					apiKeyId
				},
				'Revoke API key rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(null, { status: 204 });
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'auth.api_keys.revoke.failed', error: toLogError(err), apiKeyId },
			'Failed to revoke API key'
		);
		return errorResponse('Failed to revoke API key', 500);
	}
};
