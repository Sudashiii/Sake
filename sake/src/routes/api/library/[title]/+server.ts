import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import {
	getLibraryFileUseCase,
	putLibraryFileUseCase,
	deleteLibraryFileUseCase
} from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const title = params.title;
	if (!title) {
		requestLogger.warn({ event: 'library.file.fetch.validation_failed' }, 'Missing title parameter');
		return errorResponse('Missing title parameter', 400);
	}

	try {
		const result = await getLibraryFileUseCase.execute(title);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.file.fetch.use_case_failed',
					title,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch library file rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(result.value.data, {
			headers: {
				'Content-Type': result.value.contentType,
				'Content-Length': result.value.contentLength
			}
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'library.file.fetch.failed', error: toLogError(err), title }, 'Fetch library file failed');
		return errorResponse('File not found', 404);
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const title = params.title;
	if (!title) {
		requestLogger.warn({ event: 'library.file.upload.validation_failed' }, 'Missing title parameter');
		return errorResponse('Missing title parameter', 400);
	}

	try {
		const body = await request.arrayBuffer();
		const result = await putLibraryFileUseCase.execute(title, body);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.file.upload.use_case_failed',
					title,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Upload library file rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'library.file.upload.failed', error: toLogError(err), title }, 'Upload failed');
		return errorResponse('Upload failed', 500);
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const title = params.title;
	if (!title) {
		requestLogger.warn({ event: 'library.file.delete.validation_failed' }, 'Missing title parameter');
		return errorResponse('Missing title parameter', 400);
	}

	try {
		const result = await deleteLibraryFileUseCase.execute(title);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.file.delete.use_case_failed',
					title,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Delete library file rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error({ event: 'library.file.delete.failed', error: toLogError(err), title }, 'Delete failed');
		return errorResponse('Delete failed', 500);
	}
};
