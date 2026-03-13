import { deleteDeviceUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const requestLogger = getRequestLogger(locals);

	if (locals.auth?.type !== 'session') {
		return errorResponse('Authentication required', 401);
	}

	const deviceId = params.deviceId?.trim();
	if (!deviceId) {
		return errorResponse('Invalid device id', 400);
	}

	try {
		const result = await deleteDeviceUseCase.execute({
			userId: locals.auth.user.id,
			deviceId
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'devices.delete.use_case_failed',
					deviceId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Delete device rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		requestLogger.info({ event: 'devices.delete.succeeded', deviceId }, 'Device deleted');
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'devices.delete.failed', deviceId, error: toLogError(err) },
			'Failed to delete device'
		);
		return errorResponse('Failed to delete device', 500);
	}
};
