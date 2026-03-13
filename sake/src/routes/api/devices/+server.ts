import { listDevicesUseCase } from '$lib/server/application/composition';
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
		const result = await listDevicesUseCase.execute({
			userId: locals.auth.user.id
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'devices.list.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'List devices rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'devices.list.failed', error: toLogError(err) }, 'Failed to list devices');
		return errorResponse('Failed to list devices', 500);
	}
};
