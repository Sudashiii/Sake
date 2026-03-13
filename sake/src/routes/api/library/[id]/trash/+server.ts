import { deleteTrashedLibraryBookUseCase, moveLibraryBookToTrashUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const bookId = Number(params.id);
	if (!Number.isFinite(bookId)) {
		requestLogger.warn({ event: 'library.book.trash.validation_failed', rawId: params.id }, 'Invalid book id');
		return errorResponse('Invalid book id', 400);
	}

	try {
		const result = await moveLibraryBookToTrashUseCase.execute({ bookId });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.book.trash.use_case_failed',
					bookId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Move book to trash rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.book.trash.failed', error: toLogError(err), bookId },
			'Failed to move book to trash'
		);
		return errorResponse('Failed to move book to trash', 500);
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const bookId = Number(params.id);
	if (!Number.isFinite(bookId)) {
		requestLogger.warn({ event: 'library.book.delete.validation_failed', rawId: params.id }, 'Invalid book id');
		return errorResponse('Invalid book id', 400);
	}

	try {
		const result = await deleteTrashedLibraryBookUseCase.execute({ bookId });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.book.delete.use_case_failed',
					bookId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Delete trashed book rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.book.delete.failed', error: toLogError(err), bookId },
			'Failed to delete trashed book'
		);
		return errorResponse('Failed to delete trashed book', 500);
	}
};
