import { listLibraryTrashUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const result = await listLibraryTrashUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.trash.list.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'List trash rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'library.trash.list.failed', error: toLogError(err) }, 'Failed to fetch trash books');
		return errorResponse('Failed to fetch trash books', 500);
	}
};
