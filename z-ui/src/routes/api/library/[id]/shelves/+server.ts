import { setBookShelvesUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const bookId = Number(params.id);
	if (!Number.isInteger(bookId) || bookId <= 0) {
		return errorResponse('Invalid book id', 400);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.book.shelves.invalid_json', error: toLogError(err), bookId },
			'Invalid JSON body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	const shelfIds = (body as { shelfIds?: unknown }).shelfIds;
	if (!Array.isArray(shelfIds)) {
		return errorResponse('shelfIds is required and must be an array', 400);
	}

	if (!shelfIds.every((value) => Number.isInteger(value) && Number(value) > 0)) {
		return errorResponse('shelfIds must contain positive integer IDs only', 400);
	}

	try {
		const result = await setBookShelvesUseCase.execute({
			bookId,
			shelfIds: shelfIds.map((value) => Number(value))
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.book.shelves.use_case_failed',
					bookId,
					statusCode: result.error.status,
					reason: result.error.message,
					shelfIds
				},
				'Set book shelves rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.book.shelves.failed', error: toLogError(err), bookId, shelfIds },
			'Failed to set book shelves'
		);
		return errorResponse('Failed to set book shelves', 500);
	}
};
