export const SAKE_CLEAR_SESSION_HEADER_NAME = 'x-sake-clear-session';
export const SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME = 'x-sake-clear-zlibrary-auth';
export const ZLIBRARY_NAME_STORAGE_KEY = 'zlibName';
export const ZLIBRARY_AUTH_CLEARED_EVENT_NAME = 'sake:zlibrary-auth-cleared';

export function isAuthenticationFailureStatus(status: number): boolean {
	return status === 401 || status === 403;
}
