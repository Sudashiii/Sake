// -------------------------------
// GET /api/zlibrary/logout
// -------------------------------
import { zlibraryLogoutUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const logoutResult = await zlibraryLogoutUseCase.execute();
		if (!logoutResult.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.logout.use_case_failed',
					statusCode: logoutResult.error.status,
					reason: logoutResult.error.message
				},
				'Logout rejected'
			);
			return errorResponse(logoutResult.error.message, logoutResult.error.status);
		}

		const response = new Response(JSON.stringify(logoutResult.value), { status: 200 });

		response.headers.append(
			'Set-Cookie',
			'userId=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
		);
		response.headers.append(
			'Set-Cookie',
			'userKey=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
		);

		return response;
	} catch (err: unknown) {
		requestLogger.error({ event: 'zlibrary.logout.failed', error: toLogError(err) }, 'Logout failed');
		return errorResponse('Logout failed', 500);
	}
};
