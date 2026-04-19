import { loginLocalAccountUseCase } from '$lib/server/application/composition';
import { clearZlibraryCookies, setSakeSessionCookie } from '$lib/server/auth/cookies';
import { buildRateLimitKeyPart, enforceAuthRateLimits } from '$lib/server/auth/rateLimit';
import { getRequestIp, getRequestUserAgent } from '$lib/server/auth/requestMetadata';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { request, locals, cookies } = event;
	const requestLogger = getRequestLogger(locals);
	const ipAddress = getRequestIp(request);
	let body: { username?: unknown; password?: unknown };

	try {
		body = (await request.json()) as { username?: unknown; password?: unknown };
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'auth.login.invalid_json', error: toLogError(err) },
			'Invalid login request body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	const username = typeof body.username === 'string' ? body.username : '';
	const rateLimitResponse = enforceAuthRateLimits([
		{
			policyName: 'loginIp',
			key: buildRateLimitKeyPart(ipAddress, 'unknown-ip')
		},
		{
			policyName: 'loginUsername',
			key: buildRateLimitKeyPart(username, 'missing-username')
		}
	]);
	if (rateLimitResponse) {
		requestLogger.warn(
			{
				event: 'auth.login.rate_limited',
				ipAddress,
				username: username.trim() || null
			},
			'Login rate limited'
		);
		return rateLimitResponse;
	}

	try {
		const result = await loginLocalAccountUseCase.execute({
			username,
			password: typeof body.password === 'string' ? body.password : '',
			userAgent: getRequestUserAgent(request),
			ipAddress
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.login.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Login rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		setSakeSessionCookie(cookies, event, result.value.sessionToken, result.value.sessionExpiresAt);
		clearZlibraryCookies(cookies, event);

		return json({
			success: true,
			user: result.value.user
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.login.failed', error: toLogError(err) }, 'Login failed');
		return errorResponse('Login failed', 500);
	}
};
