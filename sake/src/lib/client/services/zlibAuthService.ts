import { type Result, ok, err } from '$lib/types/Result';
import type { ApiError } from '$lib/types/ApiError';
import { ZLIBRARY_NAME_STORAGE_KEY } from '$lib/auth/responseSignals';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import type { ZTokenLoginRequest } from '$lib/types/ZLibrary/Requests/ZTokenLoginRequest';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import { ZUI } from '../zui';

export const ZLIBRARY_TOKEN_LOGIN_LABEL = 'Connected with remix credentials';

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
		const result = await ZUI.tokenLogin(payload);

		if (result.ok) {
			this.storeUserName(ZLIBRARY_TOKEN_LOGIN_LABEL);
		}

		return result;
	},

	async logout(): Promise<Result<void, ApiError>> {
		const result = await ZUI.logoutZLibrary();

		if (result.ok) {
			this.clearUserName();
		}

		return result;
	},

	/**
	 * Gets the stored Z-Library user name.
	 */
	getStoredUserName(): string {
		if (typeof localStorage === 'undefined') {
			return '';
		}
		return localStorage.getItem(ZLIBRARY_NAME_STORAGE_KEY) || '';
	},

	/**
	 * Stores the Z-Library user name.
	 */
	storeUserName(name: string): void {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(ZLIBRARY_NAME_STORAGE_KEY, name);
		}
	},

	/**
	 * Clears the stored Z-Library user name.
	 */
	clearUserName(): void {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(ZLIBRARY_NAME_STORAGE_KEY);
		}
	},

	/**
	 * Checks if a Z-Library user is logged in.
	 */
	isLoggedIn(): boolean {
		return this.getStoredUserName() !== '';
	}
} as const;
