import {
	SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME,
	isAuthenticationFailureStatus
} from '$lib/auth/responseSignals';
import { clearZlibraryCookies } from '$lib/server/auth/cookies';
import { errorResponse, withResponseHeader } from '$lib/server/http/api';
import type { Cookies } from '@sveltejs/kit';

export function zlibraryAuthFailureResponse(
	message: string,
	status: number,
	cookies: Cookies,
	url: URL
): Response {
	const response = errorResponse(message, status);

	if (!isAuthenticationFailureStatus(status)) {
		return response;
	}

	clearZlibraryCookies(cookies, url);
	return withResponseHeader(response, SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME, 'true');
}
