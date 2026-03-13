import { listLibraryUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const result = await listLibraryUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{ event: 'library.list.use_case_failed', statusCode: result.error.status, reason: result.error.message },
				'List library rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'library.list.failed', error: toLogError(err) }, 'Failed to fetch library books');
		return errorResponse('Failed to fetch library books', 500);
	}
};
