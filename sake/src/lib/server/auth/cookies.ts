import type { Cookies } from '@sveltejs/kit';
import { SAKE_SESSION_COOKIE_NAME } from '$lib/server/auth/constants';

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

function getFirstHeaderToken(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const [first] = value.split(',');
	const normalized = first?.trim().toLowerCase();
	return normalized ? normalized : null;
}

function getForwardedProto(request: Request): 'http' | 'https' | null {
	const forwarded = request.headers.get('forwarded');
	if (forwarded) {
		const match = forwarded.match(/(?:^|[;,]\s*)proto="?([^;,\s"]+)"?/i);
		const proto = match?.[1]?.trim().toLowerCase();
		if (proto === 'http' || proto === 'https') {
			return proto;
		}
	}

	const xForwardedProto = getFirstHeaderToken(request.headers.get('x-forwarded-proto'));
	if (xForwardedProto === 'http' || xForwardedProto === 'https') {
		return xForwardedProto;
	}

	const xForwardedSsl = getFirstHeaderToken(request.headers.get('x-forwarded-ssl'));
	if (xForwardedSsl === 'on') {
		return 'https';
	}
	if (xForwardedSsl === 'off') {
		return 'http';
	}

	const frontEndHttps = getFirstHeaderToken(request.headers.get('front-end-https'));
	if (frontEndHttps === 'on') {
		return 'https';
	}
	if (frontEndHttps === 'off') {
		return 'http';
	}

	return null;
}

function getSocketEncryptionState(context: CookieSecurityContext): boolean | null {
	const socket = context.platform?.req?.socket;
	if (!socket) {
		return null;
	}

	return socket.encrypted === true;
}

export function isSecureRequest(context: CookieSecurityContext): boolean {
	const forwardedProto = getForwardedProto(context.request);
	if (forwardedProto) {
		return forwardedProto === 'https';
	}

	const socketEncrypted = getSocketEncryptionState(context);
	if (socketEncrypted !== null) {
		return socketEncrypted;
	}

	return context.url.protocol === 'https:';
}

export function setSakeSessionCookie(
	cookies: Cookies,
	context: CookieSecurityContext,
	token: string,
	expiresAt: string
): void {
	cookies.set(SAKE_SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecureRequest(context),
		expires: new Date(expiresAt)
	});
}

export function clearSakeSessionCookie(cookies: Cookies, context: CookieSecurityContext): void {
	cookies.delete(SAKE_SESSION_COOKIE_NAME, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecureRequest(context)
	});
}

export function clearZlibraryCookies(cookies: Cookies, context: CookieSecurityContext): void {
	const cookieOptions = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: isSecureRequest(context)
	};

	cookies.delete('userId', cookieOptions);
	cookies.delete('userKey', cookieOptions);
}
