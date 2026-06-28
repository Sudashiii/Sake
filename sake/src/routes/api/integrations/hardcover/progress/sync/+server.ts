import { triggerHardcoverProgressSyncUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (locals.auth?.type !== 'session') return errorResponse('Authentication required', 401);
	try {
		const result = await triggerHardcoverProgressSyncUseCase.execute();
		return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
	} catch (err: unknown) {
		getRequestLogger(locals).error(
			{ event: 'hardcover.progress.trigger.failed', error: toLogError(err) },
			'Failed to trigger Hardcover progress sync'
		);
		return errorResponse('Failed to trigger Hardcover progress sync', 500);
	}
};
