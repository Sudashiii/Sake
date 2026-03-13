import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getProgressUseCase, putProgressUseCase } from '$lib/server/application/composition';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async ({ url, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const fileName = url.searchParams.get('fileName');
	if (!fileName) {
		requestLogger.warn({ event: 'progress.fetch.validation_failed' }, 'Missing fileName parameter');
		return errorResponse('Missing fileName parameter', 400);
	}

	try {
		const result = await getProgressUseCase.execute({ fileName });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'progress.fetch.use_case_failed',
					fileName,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Progress fetch rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(result.value.data, {
			headers: {
				'Content-Type': 'application/x-lua',
				'Content-Disposition': `attachment; filename="${result.value.metadataFileName}"`
			}
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'progress.fetch.failed', error: toLogError(err), fileName },
			'Progress fetch failed'
		);
		return errorResponse('Progress file not found', 404);
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const formData = await request.formData();
		const fileName = formData.get('fileName');
		const file = formData.get('file');
		const deviceId = formData.get('deviceId');
		const percentFinishedRaw = formData.get('percentFinished');

		if (typeof fileName !== 'string' || fileName.length === 0) {
			requestLogger.warn({ event: 'progress.upload.validation_failed', reason: 'fileName missing' }, 'Missing fileName in form data');
			return errorResponse('Missing fileName in form data', 400);
		}
		if (!file || typeof (file as File).arrayBuffer !== 'function') {
			requestLogger.warn({ event: 'progress.upload.validation_failed', reason: 'file missing' }, 'Missing file in form data');
			return errorResponse('Missing file in form data', 400);
		}
		if (typeof percentFinishedRaw !== 'string' || percentFinishedRaw.trim() === '') {
			requestLogger.warn(
				{ event: 'progress.upload.validation_failed', reason: 'percentFinished missing' },
				'Missing percentFinished in form data'
			);
			return errorResponse('Missing percentFinished in form data', 400);
		}

		const percentFinished = Number.parseFloat(percentFinishedRaw);
		if (!Number.isFinite(percentFinished) || percentFinished < 0 || percentFinished > 1) {
			requestLogger.warn(
				{
					event: 'progress.upload.validation_failed',
					reason: 'percentFinished invalid',
					percentFinishedRaw
				},
				'Invalid percentFinished in form data'
			);
			return errorResponse('percentFinished must be a number between 0 and 1', 400);
		}

		const deviceResult = resolveAuthorizedDeviceId(
			locals,
			typeof deviceId === 'string' ? deviceId : null
		);
		if (!deviceResult.ok) {
			requestLogger.warn(
				{
					event: 'progress.upload.validation_failed',
					reason: deviceResult.message,
					statusCode: deviceResult.status,
					deviceId
				},
				deviceResult.message
			);
			return errorResponse(deviceResult.message, deviceResult.status);
		}

		const body = await (file as File).arrayBuffer();
		const result = await putProgressUseCase.execute({
			fileName,
			fileData: body,
			percentFinished,
			deviceId: deviceResult.deviceId ?? undefined
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'progress.upload.use_case_failed',
					fileName,
					deviceId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Progress upload rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json({
			success: true,
			progressKey: result.value.progressKey
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'progress.upload.failed', error: toLogError(err) }, 'Progress upload failed');
		return errorResponse('Progress upload failed', 500);
	}
};
