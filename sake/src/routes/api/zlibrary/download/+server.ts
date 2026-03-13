import { downloadBookUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	let body: ZDownloadBookRequest;
	try {
		body = (await request.json()) as ZDownloadBookRequest;
	} catch (err: unknown) {
		requestLogger.warn({ event: 'zlibrary.download.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
		return errorResponse('Invalid JSON body', 400);
	}
	const { bookId, hash } = body;

	if (!locals.zuser) {
		requestLogger.warn({ event: 'zlibrary.download.auth_missing', bookId }, 'Z-Library login is not valid');
		return errorResponse('Z-Library login is not valid', 400);
	}

	if (!bookId || !hash) {
		requestLogger.warn({ event: 'zlibrary.download.validation_failed', bookId, hash }, 'Missing bookId or hash parameter');
		return errorResponse('Missing bookId or hash parameter', 400);
	}

	try {
		const result = await downloadBookUseCase.execute({
			request: body,
			credentials: {
				userId: locals.zuser.userId,
				userKey: locals.zuser.userKey
			}
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.download.use_case_failed',
					bookId,
					hash,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Download rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		if (body.downloadToDevice === false) {
			return json({ success: true });
		}

		return new Response(result.value.fileData, {
			headers: result.value.responseHeaders
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'zlibrary.download.failed', error: toLogError(err), bookId, hash },
			'Download failed'
		);
		return errorResponse('Download failed', 500);
	}
};
