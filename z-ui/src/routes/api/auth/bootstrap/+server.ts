import { bootstrapLocalAccountUseCase } from '$lib/server/application/composition';
import {
	hasLegacyBasicAuthConfigured,
	matchesLegacyBasicAuth,
	requireLegacyBasicAuth
} from '$lib/server/auth/basicAuth';
import { clearZlibraryCookies, setSakeSessionCookie } from '$lib/server/auth/cookies';
import { getRequestIp, getRequestUserAgent } from '$lib/server/auth/requestMetadata';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies, url }) => {
	const requestLogger = getRequestLogger(locals);
	let body: {
		username?: unknown;
		password?: unknown;
		legacyUsername?: unknown;
		legacyPassword?: unknown;
	};

	try {
		body = (await request.json()) as {
			username?: unknown;
			password?: unknown;
			legacyUsername?: unknown;
			legacyPassword?: unknown;
		};
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'auth.bootstrap.invalid_json', error: toLogError(err) },
			'Invalid bootstrap request body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	if (hasLegacyBasicAuthConfigured()) {
		try {
			requireLegacyBasicAuth(request);
		} catch (err) {
			const legacyUsername = typeof body.legacyUsername === 'string' ? body.legacyUsername : '';
			const legacyPassword = typeof body.legacyPassword === 'string' ? body.legacyPassword : '';

			if (matchesLegacyBasicAuth(legacyUsername, legacyPassword)) {
				// Allow browser bootstrap without requiring a Basic Auth prompt.
			} else if (err instanceof Response) {
				return err;
			} else {
				throw err;
			}
		}
	}

	try {
		const result = await bootstrapLocalAccountUseCase.execute({
			username: typeof body.username === 'string' ? body.username : '',
			password: typeof body.password === 'string' ? body.password : '',
			userAgent: getRequestUserAgent(request),
			ipAddress: getRequestIp(request)
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
