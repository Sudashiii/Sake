import { bootstrapLocalAccountUseCase } from '$lib/server/application/composition';
import { clearZlibraryCookies, setSakeSessionCookie } from '$lib/server/auth/cookies';
import { buildRateLimitKeyPart, enforceAuthRateLimits } from '$lib/server/auth/rateLimit';
import { getRequestIp, getRequestUserAgent } from '$lib/server/auth/requestMetadata';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies, url }) => {
	const requestLogger = getRequestLogger(locals);
	const ipAddress = getRequestIp(request);
	let body: {
		username?: unknown;
		password?: unknown;
	};

	try {
		body = (await request.json()) as {
			username?: unknown;
			password?: unknown;
		};
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'auth.bootstrap.invalid_json', error: toLogError(err) },
			'Invalid bootstrap request body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	const rateLimitResponse = enforceAuthRateLimits([
		{
			policyName: 'bootstrapIp',
			key: buildRateLimitKeyPart(ipAddress, 'unknown-ip')
		}
	]);
	if (rateLimitResponse) {
		requestLogger.warn(
			{ event: 'auth.bootstrap.rate_limited', ipAddress },
			'Bootstrap rate limited'
		);
		return rateLimitResponse;
	}

	try {
		const result = await bootstrapLocalAccountUseCase.execute({
			username: typeof body.username === 'string' ? body.username : '',
			password: typeof body.password === 'string' ? body.password : '',
			userAgent: getRequestUserAgent(request),
			ipAddress
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.bootstrap.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Bootstrap rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		setSakeSessionCookie(cookies, url, result.value.sessionToken, result.value.sessionExpiresAt);
		clearZlibraryCookies(cookies, url);

		return json({
			success: true,
			user: result.value.user
		}, { status: 201 });
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.bootstrap.failed', error: toLogError(err) }, 'Bootstrap failed');
		return errorResponse('Bootstrap failed', 500);
	}
};
