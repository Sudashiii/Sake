import { createDeviceApiKeyUseCase } from '$lib/server/application/composition';
import { SAKE_VERSION_HEADER_NAME } from '$lib/server/auth/constants';
import { buildRateLimitKeyPart, enforceAuthRateLimits } from '$lib/server/auth/rateLimit';
import { getRequestIp } from '$lib/server/auth/requestMetadata';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const ipAddress = getRequestIp(request);
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

	const username = typeof body.username === 'string' ? body.username : '';
	const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
	const rateLimitResponse = enforceAuthRateLimits([
		{
			policyName: 'deviceKeyIp',
			key: buildRateLimitKeyPart(ipAddress, 'unknown-ip')
		},
		{
			policyName: 'deviceKeyUserDevice',
			key: `${buildRateLimitKeyPart(username, 'missing-username')}::${buildRateLimitKeyPart(deviceId, 'missing-device')}`
		}
	]);
	if (rateLimitResponse) {
		requestLogger.warn(
			{
				event: 'auth.device_key.rate_limited',
				ipAddress,
				username: username.trim() || null,
				deviceId: deviceId.trim() || null
			},
			'Device key creation rate limited'
		);
		return rateLimitResponse;
	}

	try {
		const pluginVersionHeader = request.headers.get(SAKE_VERSION_HEADER_NAME);
		const result = await createDeviceApiKeyUseCase.execute({
			username,
			password: typeof body.password === 'string' ? body.password : '',
			deviceId,
			pluginVersion: pluginVersionHeader
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
