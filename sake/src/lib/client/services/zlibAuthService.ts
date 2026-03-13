import { type Result, ok, err } from '$lib/types/Result';
import type { ApiError } from '$lib/types/ApiError';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import type { ZTokenLoginRequest } from '$lib/types/ZLibrary/Requests/ZTokenLoginRequest';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import { ZUI } from '../zui';

const ZLIB_NAME_KEY = 'zlibName';

/**
 * Service for Z-Library authentication operations.
 */
export const ZLibAuthService = {
	/**
	 * Login with email and password.
	 */
	async passwordLogin(email: string, password: string): Promise<Result<ZLoginResponse, ApiError>> {
		const payload: ZLoginRequest = { email, password };
		const result = await ZUI.passwordLogin(payload);

		if (result.ok) {
			this.storeUserName(result.value.user.name);
		}

		return result;
	},

	/**
	 * Login with userId and userKey tokens.
	 */
	async tokenLogin(userId: string, userKey: string): Promise<Result<void, ApiError>> {
		const payload: ZTokenLoginRequest = { userId, userKey };
		return ZUI.tokenLogin(payload);
	},

	/**
	 * Gets the stored Z-Library user name.
	 */
	getStoredUserName(): string {
		if (typeof localStorage === 'undefined') {
			return '';
		}
		return localStorage.getItem(ZLIB_NAME_KEY) || '';
	},

	/**
	 * Stores the Z-Library user name.
	 */
	storeUserName(name: string): void {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(ZLIB_NAME_KEY, name);
		}
	},

	/**
	 * Clears the stored Z-Library user name.
	 */
	clearUserName(): void {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(ZLIB_NAME_KEY);
		}
	},

	/**
	 * Checks if a Z-Library user is logged in.
	 */
	isLoggedIn(): boolean {
		return this.getStoredUserName() !== '';
	}
} as const;
