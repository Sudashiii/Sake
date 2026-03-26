import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { exportDeviceLibraryBookUseCase } from '$lib/server/application/composition';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);

	try {
		const formData = await request.formData();
		const fileName = formData.get('fileName');
		const file = formData.get('file');
		const sidecarFile = formData.get('sidecarFile');
		const deviceResult = resolveAuthorizedDeviceId(locals, formData.get('deviceId')?.toString(), {
			required: true
		});

		if (!deviceResult.ok) {
			requestLogger.warn(
				{
					event: 'library.export.validation_failed',
					reason: deviceResult.message,
					statusCode: deviceResult.status
				},
				deviceResult.message
			);
			return errorResponse(deviceResult.message, deviceResult.status);
		}

		if (typeof fileName !== 'string' || fileName.trim().length === 0) {
			requestLogger.warn(
				{ event: 'library.export.validation_failed', reason: 'fileName missing' },
				'Missing fileName in form data'
			);
			return errorResponse('Missing fileName in form data', 400);
		}

		if (!file || typeof (file as File).arrayBuffer !== 'function') {
			requestLogger.warn(
				{ event: 'library.export.validation_failed', reason: 'file missing' },
				'Missing file in form data'
			);
			return errorResponse('Missing file in form data', 400);
		}

		if (sidecarFile !== null && typeof (sidecarFile as File).arrayBuffer !== 'function') {
			requestLogger.warn(
				{ event: 'library.export.validation_failed', reason: 'sidecarFile invalid' },
				'Invalid sidecarFile in form data'
			);
			return errorResponse('Invalid sidecarFile in form data', 400);
		}

		const result = await exportDeviceLibraryBookUseCase.execute({
			deviceId: deviceResult.deviceId,
			fileName,
			fileData: await (file as File).arrayBuffer(),
			sidecarData:
				sidecarFile && typeof (sidecarFile as File).arrayBuffer === 'function'
					? await (sidecarFile as File).arrayBuffer()
					: undefined
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.export.use_case_failed',
					fileName,
					deviceId: deviceResult.deviceId,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Library export rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.export.failed', error: toLogError(err) },
			'Library export failed'
		);
		return errorResponse('Library export failed', 500);
	}
};
