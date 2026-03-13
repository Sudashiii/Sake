import { reportDeviceVersionUseCase } from '$lib/server/application/composition';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	if (!locals.auth) {
		return errorResponse('Authentication required', 401);
	}
	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch (err: unknown) {
			requestLogger.warn({ event: 'device.version.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
			return errorResponse('Invalid JSON body', 400);
		}

		const payload = body as { deviceId?: unknown; version?: unknown };
		const suppliedDeviceId = typeof payload.deviceId === 'string' ? payload.deviceId : undefined;
		const deviceResult = resolveAuthorizedDeviceId(locals, suppliedDeviceId, { required: true });
		const version = typeof payload.version === 'string' ? payload.version : null;

		if (!deviceResult.ok || !version) {
			requestLogger.warn(
				{
					event: 'device.version.validation_failed',
					deviceId: suppliedDeviceId,
					version,
					statusCode: deviceResult.ok ? 400 : deviceResult.status,
					reason: deviceResult.ok ? 'deviceId and version are required' : deviceResult.message
				},
				deviceResult.ok ? 'deviceId and version are required' : deviceResult.message
			);
			return errorResponse(
				deviceResult.ok ? 'deviceId and version are required' : deviceResult.message,
				deviceResult.ok ? 400 : deviceResult.status
			);
		}

		const deviceId = deviceResult.deviceId;
		const result = await reportDeviceVersionUseCase.execute({
			userId: locals.auth.user.id,
			deviceId,
			version
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'device.version.use_case_failed',
					deviceId,
					version,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Report device version rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		requestLogger.info(
			{ event: 'device.version.recorded', deviceId, version: result.value.version },
			'Device version recorded'
		);
		return json(result.value, { status: 200 });
	} catch (err: unknown) {
		requestLogger.error({ event: 'device.version.failed', error: toLogError(err) }, 'Failed to record device version');
		return errorResponse('Failed to record device version', 500);
	}
};
