import { listLibraryRatingsUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const result = await listLibraryRatingsUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{ event: 'library.ratings.use_case_failed', statusCode: result.error.status, reason: result.error.message },
				'List library ratings rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.ratings.failed', error: toLogError(err) },
			'Failed to fetch library ratings'
		);
		return errorResponse('Failed to fetch library ratings', 500);
	}
};
