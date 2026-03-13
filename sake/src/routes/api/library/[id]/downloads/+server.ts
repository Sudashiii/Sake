import { resetDownloadStatusUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
    const { id } = params;

	if (!id) {
		requestLogger.warn({ event: 'library.download.reset.validation_failed' }, 'Missing book id');
		return errorResponse('Missing book id', 400);
	}

	try {
		const result = await resetDownloadStatusUseCase.execute(Number(id));
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.download.reset.use_case_failed',
					bookId: Number(id),
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Reset download status rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.download.reset.failed', error: toLogError(err), bookId: Number(id) },
			'Failed to reset download status'
		);
		return errorResponse('Failed to reset download status', 500);
	}
};
