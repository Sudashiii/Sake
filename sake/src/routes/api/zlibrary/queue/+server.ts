import { getQueueStatusUseCase, queueDownloadUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

/**
 * Queue a book for download to library (async, returns immediately)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	let body: ZDownloadBookRequest;
	try {
		body = (await request.json()) as ZDownloadBookRequest;
	} catch (err: unknown) {
		requestLogger.warn({ event: 'zlibrary.queue.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
		return errorResponse('Invalid JSON body', 400);
	}
	const { bookId, hash } = body;

	if (!locals.zuser) {
		requestLogger.warn({ event: 'zlibrary.queue.auth_missing', bookId }, 'Z-Library login is not valid');
		return errorResponse('Z-Library login is not valid', 400);
	}

	if (!bookId || !hash) {
		requestLogger.warn({ event: 'zlibrary.queue.validation_failed', bookId, hash }, 'Missing bookId or hash parameter');
		return errorResponse('Missing bookId or hash parameter', 400);
	}

	try {
		const result = await queueDownloadUseCase.execute({
			request: body,
			credentials: {
				userId: locals.zuser.userId,
				userKey: locals.zuser.userKey
			}
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.queue.use_case_failed',
					bookId,
					hash,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Queue request rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'zlibrary.queue.failed', error: toLogError(err), bookId, hash },
			'Failed to queue download'
		);
		return errorResponse('Failed to queue download', 500);
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const result = await getQueueStatusUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.queue.status.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Queue status rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'zlibrary.queue.status.failed', error: toLogError(err) },
			'Failed to fetch queue status'
		);
		return errorResponse('Failed to fetch queue status', 500);
	}
};
