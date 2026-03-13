import { removeDeviceDownloadUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const bookId = Number(params.id);
	const deviceId = params.deviceId?.trim();

	if (!Number.isFinite(bookId)) {
		requestLogger.warn(
			{ event: 'library.download.device.remove.validation_failed', rawId: params.id },
			'Invalid book id'
		);
		return errorResponse('Invalid book id', 400);
	}

	if (!deviceId) {
		requestLogger.warn({ event: 'library.download.device.remove.validation_failed', bookId }, 'Missing device id');
		return errorResponse('Missing device id', 400);
	}

	try {
		const result = await removeDeviceDownloadUseCase.execute({ bookId, deviceId });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.download.device.remove.use_case_failed',
					bookId,
					deviceId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Remove device download rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.download.device.remove.failed', error: toLogError(err), bookId, deviceId },
			'Failed to remove device download'
		);
		return errorResponse('Failed to remove device download', 500);
	}
};
