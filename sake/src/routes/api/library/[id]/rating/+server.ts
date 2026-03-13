import { updateBookRatingUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const id = Number(params.id);
	if (!Number.isFinite(id)) {
		requestLogger.warn({ event: 'library.book.rating.validation_failed', rawId: params.id }, 'Invalid book id');
		return errorResponse('Invalid book id', 400);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch (err: unknown) {
		requestLogger.warn({ event: 'library.book.rating.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
		return errorResponse('Invalid JSON body', 400);
	}

	const rating = (body as { rating?: unknown }).rating;
	if (!(rating === null || typeof rating === 'number')) {
		requestLogger.warn(
			{ event: 'library.book.rating.validation_failed', bookId: id, rating },
			'Missing or invalid rating value'
		);
		return errorResponse('rating must be null or a number', 400);
	}

	try {
		const result = await updateBookRatingUseCase.execute({ bookId: id, rating });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.book.rating.use_case_failed',
					bookId: id,
					rating,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Update book rating rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.book.rating.failed', error: toLogError(err), bookId: id, rating },
			'Failed to update book rating'
		);
		return errorResponse('Failed to update book rating', 500);
	}
};
