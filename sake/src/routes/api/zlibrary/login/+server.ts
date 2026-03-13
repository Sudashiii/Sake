import { zlibraryTokenLoginUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { ZTokenLoginRequest } from '$lib/types/ZLibrary/Requests/ZTokenLoginRequest';
import type { RequestHandler } from '@sveltejs/kit';

// -------------------------------
// POST /api/zlibrary/login
// -------------------------------
export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	let body: ZTokenLoginRequest;
	try {
		body = (await request.json()) as ZTokenLoginRequest;
	} catch (err: unknown) {
		requestLogger.warn({ event: 'zlibrary.login.invalid_json', error: toLogError(err) }, 'Invalid JSON body');
		return errorResponse('Invalid JSON body', 400);
	}

		try {
			const loginResult = await zlibraryTokenLoginUseCase.execute(body);
		if (!loginResult.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.login.use_case_failed',
					statusCode: loginResult.error.status,
					reason: loginResult.error.message
				},
				'Z-Library login rejected'
			);
			return errorResponse(loginResult.error.message, loginResult.error.status);
		}

		const response = new Response(JSON.stringify({ success: true }), { status: 200 });
		response.headers.append(
			'Set-Cookie',
			`userId=${loginResult.value.userId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
		);
		response.headers.append(
			'Set-Cookie',
			`userKey=${loginResult.value.userKey}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
		);

		return response;
	} catch (err: unknown) {
		requestLogger.error({ event: 'zlibrary.login.failed', error: toLogError(err) }, 'Z-Library login failed');
		return errorResponse('Z-Library login failed', 500);
	}
};
