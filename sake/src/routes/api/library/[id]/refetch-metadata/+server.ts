import { refetchLibraryBookMetadataUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const id = Number(params.id);
	if (!Number.isFinite(id)) {
		requestLogger.warn({ event: 'library.metadata.refetch.validation_failed', rawId: params.id }, 'Invalid book id');
		return errorResponse('Invalid book id', 400);
	}

	try {
		const result = await refetchLibraryBookMetadataUseCase.execute({
			bookId: id
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.metadata.refetch.use_case_failed',
					bookId: id,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Refetch metadata rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.metadata.refetch.failed', error: toLogError(err), bookId: id },
			'Failed to refetch library metadata'
		);
		return errorResponse('Failed to refetch library metadata', 500);
	}
};
