import { restoreLibraryBookUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const bookId = Number(params.id);
	if (!Number.isFinite(bookId)) {
		requestLogger.warn({ event: 'library.book.restore.validation_failed', rawId: params.id }, 'Invalid book id');
		return errorResponse('Invalid book id', 400);
	}

	try {
		const result = await restoreLibraryBookUseCase.execute({ bookId });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.book.restore.use_case_failed',
					bookId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Restore book rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'library.book.restore.failed', error: toLogError(err), bookId }, 'Failed to restore book');
		return errorResponse('Failed to restore book', 500);
	}
};
