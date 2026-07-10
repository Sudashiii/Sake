import { zlibraryPasswordLoginUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { parseZPasswordLoginRequest } from '$lib/server/http/zlibraryRequests';
import type { RequestHandler } from '@sveltejs/kit';

// -------------------------------
// POST /api/zlibrary/passwordLogin
// -------------------------------
export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	let body: ReturnType<typeof parseZPasswordLoginRequest>;
	try {
		body = parseZPasswordLoginRequest(await request.json());
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'zlibrary.passwordLogin.invalid_payload', error: toLogError(err) },
			'Invalid login payload'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid JSON body', 400);
	}

	try {
		const userResponse = await zlibraryPasswordLoginUseCase.execute(body);
		if (!userResponse.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.passwordLogin.use_case_failed',
					statusCode: userResponse.error.status,
					reason: userResponse.error.message
				},
				'Password login rejected'
			);
			return errorResponse(userResponse.error.message, userResponse.error.status);
		}

		const response = new Response(JSON.stringify(userResponse.value), { status: 200 });

		response.headers.append(
			'Set-Cookie',
			`userId=${userResponse.value.user.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
		);
		response.headers.append(
			'Set-Cookie',
			`userKey=${userResponse.value.user.remix_userkey}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
		);

		return response;
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'zlibrary.passwordLogin.failed', error: toLogError(err) },
			'Password login failed'
		);
		return errorResponse('Password login failed', 500);
	}
};
