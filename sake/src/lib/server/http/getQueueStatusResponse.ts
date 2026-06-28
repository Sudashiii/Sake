import { getQueueStatusUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';

export async function getQueueStatusResponse(locals: App.Locals): Promise<Response> {
	const requestLogger = locals.logger;
	if (locals.auth?.type !== 'session') {
		requestLogger?.warn({ event: 'queue.status.auth_missing' }, 'Authentication required for queue status');
		return errorResponse('Authentication required', 401);
	}

	try {
		const result = await getQueueStatusUseCase.execute();
		if (!result.ok) {
			requestLogger?.warn(
				{
					event: 'queue.status.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Queue status rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger?.error(
			{ event: 'queue.status.failed', error: toLogError(err) },
			'Failed to fetch queue status'
		);
		return errorResponse('Failed to fetch queue status', 500);
	}
}
