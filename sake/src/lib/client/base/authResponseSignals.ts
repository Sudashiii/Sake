import {
	SAKE_CLEAR_SESSION_HEADER_NAME,
	SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME,
	ZLIBRARY_AUTH_CLEARED_EVENT_NAME,
	ZLIBRARY_NAME_STORAGE_KEY
} from '$lib/auth/responseSignals';

interface AuthResponseSignalContext {
	pathname: string;
	appRootPath: string;
	replace: (href: string) => void;
	removeItem: (key: string) => void;
	dispatchEvent: (event: Event) => void;
	createEvent: (type: string) => Event;
}

function getDefaultContext(): AuthResponseSignalContext | null {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return null;
	}

	return {
		pathname: window.location.pathname,
		appRootPath: new URL('./', window.location.href).pathname || '/',
		replace: (href: string) => window.location.replace(href),
		removeItem: (key: string) => localStorage.removeItem(key),
		dispatchEvent: (event: Event) => window.dispatchEvent(event),
		createEvent: (type: string) => new CustomEvent(type)
	};
}

export function applyAuthResponseSignals(
	response: Pick<Response, 'headers'>,
	context: AuthResponseSignalContext | null = getDefaultContext()
): void {
	if (!context) {
		return;
	}

	if (response.headers.get(SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME) === 'true') {
		context.removeItem(ZLIBRARY_NAME_STORAGE_KEY);
		context.dispatchEvent(context.createEvent(ZLIBRARY_AUTH_CLEARED_EVENT_NAME));
	}

	if (
		response.headers.get(SAKE_CLEAR_SESSION_HEADER_NAME) === 'true' &&
		context.pathname !== context.appRootPath
	) {
		context.replace(context.appRootPath);
	}
}
