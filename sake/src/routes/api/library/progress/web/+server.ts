import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { putWebReaderProgressUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { parseWebProgressRequest } from '$lib/server/http/webReaderProgressRequest';

export const PUT: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch (error: unknown) {
		requestLogger.warn(
			{ event: 'progress.web.invalid_json', error: toLogError(error) },
			'Invalid web reader progress JSON'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	const parsed = parseWebProgressRequest(body);
	if (!parsed.ok) {
		requestLogger.warn(
			{ event: 'progress.web.validation_failed', reason: parsed.message },
			parsed.message
		);
		return errorResponse(parsed.message, 400);
	}

	try {
		const result = await putWebReaderProgressUseCase.execute(parsed.value);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'progress.web.use_case_failed',
					fileName: parsed.value.fileName,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Web reader progress update rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json({
			success: true,
			progressKey: result.value.progressKey,
			sidecar: result.value.sidecar
		});
	} catch (error: unknown) {
		requestLogger.error(
			{ event: 'progress.web.failed', error: toLogError(error) },
			'Web reader progress update failed'
		);
		return errorResponse('Web reader progress update failed', 500);
	}
};
