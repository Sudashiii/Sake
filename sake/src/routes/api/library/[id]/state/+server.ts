import { updateLibraryBookStateUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const id = Number(params.id);
	if (!Number.isFinite(id)) {
		requestLogger.warn({ event: 'library.book.state.validation_failed', rawId: params.id }, 'Invalid book id');
		return errorResponse('Invalid book id', 400);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch (err: unknown) {
		requestLogger.warn({ event: 'library.book.state.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
		return errorResponse('Invalid JSON body', 400);
	}

	const isRead = (body as { isRead?: unknown }).isRead;
	const excludeFromNewBooks = (body as { excludeFromNewBooks?: unknown }).excludeFromNewBooks;
	const archived = (body as { archived?: unknown }).archived;

	if (isRead !== undefined && typeof isRead !== 'boolean') {
		return errorResponse('isRead must be a boolean', 400);
	}

	if (excludeFromNewBooks !== undefined && typeof excludeFromNewBooks !== 'boolean') {
		return errorResponse('excludeFromNewBooks must be a boolean', 400);
	}
	if (archived !== undefined && typeof archived !== 'boolean') {
		return errorResponse('archived must be a boolean', 400);
	}

	try {
		const result = await updateLibraryBookStateUseCase.execute({
			bookId: id,
			isRead,
			excludeFromNewBooks,
			archived
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.book.state.use_case_failed',
					bookId: id,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Update book state rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.book.state.failed', error: toLogError(err), bookId: id },
			'Failed to update book state'
		);
		return errorResponse('Failed to update book state', 500);
	}
};
