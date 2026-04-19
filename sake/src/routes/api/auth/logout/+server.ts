import { logoutLocalAccountUseCase } from '$lib/server/application/composition';
import { clearSakeSessionCookie, clearZlibraryCookies } from '$lib/server/auth/cookies';
import { SAKE_SESSION_COOKIE_NAME } from '$lib/server/auth/constants';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { locals, cookies } = event;
	const requestLogger = getRequestLogger(locals);
	const sessionToken = cookies.get(SAKE_SESSION_COOKIE_NAME);

	try {
		const result = await logoutLocalAccountUseCase.execute({
			sessionToken: sessionToken ?? null
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.logout.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Logout rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		clearSakeSessionCookie(cookies, event);
		clearZlibraryCookies(cookies, event);

		return json({ success: true });
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.logout.failed', error: toLogError(err) }, 'Logout failed');
		return errorResponse('Logout failed', 500);
	}
};
