import { loginLocalAccountUseCase } from '$lib/server/application/composition';
import { clearZlibraryCookies, setSakeSessionCookie } from '$lib/server/auth/cookies';
import { getRequestIp, getRequestUserAgent } from '$lib/server/auth/requestMetadata';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies, url }) => {
	const requestLogger = getRequestLogger(locals);
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

	try {
		const result = await loginLocalAccountUseCase.execute({
			username: typeof body.username === 'string' ? body.username : '',
			password: typeof body.password === 'string' ? body.password : '',
			userAgent: getRequestUserAgent(request),
			ipAddress: getRequestIp(request)
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

		setSakeSessionCookie(cookies, url, result.value.sessionToken, result.value.sessionExpiresAt);
		clearZlibraryCookies(cookies, url);

		return json({
			success: true,
			user: result.value.user
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.login.failed', error: toLogError(err) }, 'Login failed');
		return errorResponse('Login failed', 500);
	}
};
