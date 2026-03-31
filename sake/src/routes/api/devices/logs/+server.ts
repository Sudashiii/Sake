import { appendDeviceLogUseCase } from '$lib/server/application/composition';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	if (!locals.auth) {
		return errorResponse('Authentication required', 401);
	}

	if (locals.auth.type !== 'api_key') {
		return errorResponse('API key authentication required', 403);
	}

	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch (err: unknown) {
			requestLogger.warn({ event: 'device.logs.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
			return errorResponse('Invalid JSON body', 400);
		}

		if (typeof body !== 'object' || body === null || Array.isArray(body)) {
			requestLogger.warn(
				{
					event: 'device.logs.invalid_body_shape',
					bodyType: Array.isArray(body) ? 'array' : body === null ? 'null' : typeof body
				},
				'Invalid JSON body'
			);
			return errorResponse('Invalid JSON body', 400);
		}

		const payload = body as {
			deviceId?: unknown;
			timestamp?: unknown;
			level?: unknown;
			message?: unknown;
			source?: unknown;
		};
		const suppliedDeviceId = typeof payload.deviceId === 'string' ? payload.deviceId : undefined;
		const deviceResult = resolveAuthorizedDeviceId(locals, suppliedDeviceId, { required: true });
		const timestamp = typeof payload.timestamp === 'string' ? payload.timestamp : null;
		const level = typeof payload.level === 'string' ? payload.level : null;
		const message = typeof payload.message === 'string' ? payload.message : null;
		const source = typeof payload.source === 'string' ? payload.source : null;

		if (!deviceResult.ok || !timestamp || !level || !message || !source) {
			requestLogger.warn(
				{
					event: 'device.logs.validation_failed',
					deviceId: suppliedDeviceId,
					statusCode: deviceResult.ok ? 400 : deviceResult.status,
					reason: deviceResult.ok
						? 'timestamp, level, message, and source are required'
						: deviceResult.message
				},
				deviceResult.ok
					? 'timestamp, level, message, and source are required'
					: deviceResult.message
			);
			return errorResponse(
				deviceResult.ok
					? 'timestamp, level, message, and source are required'
					: deviceResult.message,
				deviceResult.ok ? 400 : deviceResult.status
			);
		}

		const deviceId = deviceResult.deviceId;
		const result = await appendDeviceLogUseCase.execute({
			userId: locals.auth.user.id,
			deviceId,
			timestamp,
			level,
			message,
			source
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'device.logs.use_case_failed',
					deviceId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Append device log rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(null, { status: 204 });
	} catch (err: unknown) {
		requestLogger.error({ event: 'device.logs.failed', error: toLogError(err) }, 'Failed to append device log');
		return errorResponse('Failed to append device log', 500);
	}
};
