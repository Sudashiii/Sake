import {
	SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME,
	isAuthenticationFailureStatus
} from '$lib/auth/responseSignals';
import { clearZlibraryCookies } from '$lib/server/auth/cookies';
import { errorResponse, withResponseHeader } from '$lib/server/http/api';
import type { Cookies } from '@sveltejs/kit';

interface CookieSecurityContext {
	request: Request;
	url: URL;
	platform?: {
		req?: {
			socket?: {
				encrypted?: boolean;
			};
		};
	};
}

export function zlibraryAuthFailureResponse(
	message: string,
	status: number,
	cookies: Cookies,
	context: CookieSecurityContext
): Response {
	const response = errorResponse(message, status);

	if (!isAuthenticationFailureStatus(status)) {
		return response;
	}

	clearZlibraryCookies(cookies, context);
	return withResponseHeader(response, SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME, 'true');
}
