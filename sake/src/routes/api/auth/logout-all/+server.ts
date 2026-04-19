import { logoutAllLocalSessionsUseCase } from '$lib/server/application/composition';
import { clearSakeSessionCookie, clearZlibraryCookies } from '$lib/server/auth/cookies';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { locals, cookies } = event;
	const requestLogger = getRequestLogger(locals);

	if (locals.auth?.type !== 'session') {
		return errorResponse('Authentication required', 401);
	}

	try {
		const result = await logoutAllLocalSessionsUseCase.execute({
			userId: locals.auth.user.id
		});

		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'auth.logout_all.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Log out all sessions rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		clearSakeSessionCookie(cookies, event);
		clearZlibraryCookies(cookies, event);

		return json({ success: true });
	} catch (err: unknown) {
		requestLogger.error({ event: 'auth.logout_all.failed', error: toLogError(err) }, 'Log out all sessions failed');
		return errorResponse('Log out all sessions failed', 500);
	}
};
