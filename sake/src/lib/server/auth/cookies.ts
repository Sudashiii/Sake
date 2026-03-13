import type { Cookies } from '@sveltejs/kit';
import { SAKE_SESSION_COOKIE_NAME } from '$lib/server/auth/constants';

function isSecureRequest(url: URL): boolean {
	return url.protocol === 'https:';
}

export function setSakeSessionCookie(
	cookies: Cookies,
	url: URL,
	token: string,
	expiresAt: string
): void {
	cookies.set(SAKE_SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecureRequest(url),
		expires: new Date(expiresAt)
	});
}

export function clearSakeSessionCookie(cookies: Cookies, url: URL): void {
	cookies.delete(SAKE_SESSION_COOKIE_NAME, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecureRequest(url)
	});
}

export function clearZlibraryCookies(cookies: Cookies, url: URL): void {
	const cookieOptions = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: isSecureRequest(url)
	};

	cookies.delete('userId', cookieOptions);
	cookies.delete('userKey', cookieOptions);
}
