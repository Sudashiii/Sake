import { getNewProgressForDeviceUseCase } from '$lib/server/application/composition';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const deviceResult = resolveAuthorizedDeviceId(locals, url.searchParams.get('deviceId'), {
		required: true
	});

	if (!deviceResult.ok) {
		requestLogger.warn(
			{
				event: 'progress.new.validation_failed',
				statusCode: deviceResult.status,
				reason: deviceResult.message,
				requestedDeviceId: url.searchParams.get('deviceId')
			},
			deviceResult.message
		);
		return errorResponse(deviceResult.message, deviceResult.status);
	}
	const deviceId = deviceResult.deviceId;
	if (!deviceId) {
		requestLogger.warn({ event: 'progress.new.validation_failed' }, 'Missing deviceId parameter');
		return errorResponse('Missing deviceId parameter', 400);
	}

	try {
		const result = await getNewProgressForDeviceUseCase.execute(deviceId);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'progress.new.use_case_failed',
					deviceId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch new progress rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'progress.new.failed', error: toLogError(err), deviceId },
			'Failed to fetch new progress for device'
		);
		return errorResponse('Failed to fetch new progress', 500);
	}
};
