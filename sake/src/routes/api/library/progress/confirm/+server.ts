import { confirmProgressDownloadUseCase } from '$lib/server/application/composition';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch (err: unknown) {
			requestLogger.warn({ event: 'progress.confirm.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
			return errorResponse('Invalid JSON body', 400);
		}

		const payload = body as { deviceId?: string; bookId?: unknown };
		const { bookId } = payload;
		const deviceResult = resolveAuthorizedDeviceId(locals, payload.deviceId, { required: true });

		if (!deviceResult.ok || typeof bookId !== 'number') {
			requestLogger.warn(
				{
					event: 'progress.confirm.validation_failed',
					deviceId: payload.deviceId,
					bookId,
					statusCode: deviceResult.ok ? 400 : deviceResult.status,
					reason: deviceResult.ok ? 'deviceId and bookId are required' : deviceResult.message
				},
				deviceResult.ok ? 'deviceId and bookId are required' : deviceResult.message
			);
			return errorResponse(
				deviceResult.ok ? 'deviceId and bookId are required' : deviceResult.message,
				deviceResult.ok ? 400 : deviceResult.status
			);
		}
		const deviceId = deviceResult.deviceId;

		const result = await confirmProgressDownloadUseCase.execute({ deviceId, bookId });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'progress.confirm.use_case_failed',
					deviceId,
					bookId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Confirm progress download rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value, { status: 200 });
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'progress.confirm.failed', error: toLogError(err) },
			'Failed to confirm progress download'
		);
		return errorResponse('Failed to confirm progress download', 500);
	}
};
