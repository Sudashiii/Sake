import { getLibraryBookContentUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const bookId = Number(params.id);
	if (!Number.isInteger(bookId) || bookId <= 0) {
		return errorResponse('Invalid book id', 400);
	}

	try {
		const result = await getLibraryBookContentUseCase.execute(bookId);
		if (!result.ok) {
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(result.value.data, {
			headers: {
				'Cache-Control': 'private, no-store',
				'Content-Disposition': `inline; filename="${result.value.fileName.replaceAll('"', '')}"`,
				'Content-Length': result.value.contentLength,
				'Content-Type': 'application/epub+zip'
			}
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.reader.content.failed', error: toLogError(err), bookId },
			'Failed to fetch EPUB reader content'
		);
		return errorResponse('Failed to fetch book content', 500);
	}
};
