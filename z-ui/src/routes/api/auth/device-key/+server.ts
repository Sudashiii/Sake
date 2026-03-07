import { createDeviceApiKeyUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	let body: { username?: unknown; password?: unknown; deviceId?: unknown };

	try {
		body = (await request.json()) as { username?: unknown; password?: unknown; deviceId?: unknown };
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'auth.device_key.invalid_json', error: toLogError(err) },
			'Invalid device-key request body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	try {
		const result = await createDeviceApiKeyUseCase.execute({
			username: typeof body.username === 'string' ? body.username : '',
			password: typeof body.password === 'string' ? body.password : '',
			deviceId: typeof body.deviceId === 'string' ? body.deviceId : ''
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.device_key.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Device key creation rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value, { status: 201 });
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.device_key.failed', error: toLogError(err) }, 'Failed to create device key');
		return errorResponse('Failed to create device key', 500);
	}
};
