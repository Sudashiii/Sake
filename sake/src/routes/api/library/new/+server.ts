import { getNewBooksForDeviceUseCase } from '$lib/server/application/composition';
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
				event: 'library.new.validation_failed',
				statusCode: deviceResult.status,
				reason: deviceResult.message,
				requestedDeviceId: url.searchParams.get('deviceId')
			},
			deviceResult.message
		);
		return errorResponse(deviceResult.message, deviceResult.status);
	}
	const deviceId = deviceResult.deviceId;

	try {
		const result = await getNewBooksForDeviceUseCase.execute(deviceId);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.new.use_case_failed',
					deviceId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch new books rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.new.failed', error: toLogError(err), deviceId },
			'Failed to fetch new books for device'
		);
		return errorResponse('Failed to fetch new books', 500);
	}
};
