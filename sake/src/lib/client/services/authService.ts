import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { AuthStatus } from '$lib/types/Auth/AuthStatus';
import type { CurrentUser } from '$lib/types/Auth/CurrentUser';
import { getAuthStatus } from '../routes/getAuthStatus';
import { loginLocalAccount } from '../routes/loginLocalAccount';
import { bootstrapLocalAccount } from '../routes/bootstrapLocalAccount';
import { getCurrentUser } from '../routes/getCurrentUser';
import { logoutLocalAccount } from '../routes/logoutLocalAccount';
import { logoutAllLocalAccount } from '../routes/logoutAllLocalAccount';

export interface AuthCredentials {
	username: string;
	password: string;
}

export type BootstrapCredentials = AuthCredentials;

export const AuthService = {
	async getStatus(): Promise<Result<AuthStatus, ApiError>> {
		return getAuthStatus();
	},

	async login(credentials: AuthCredentials): Promise<Result<CurrentUser, ApiError>> {
		const { username, password } = credentials;

		if (!username || !password) {
			return err(ApiErrors.validation('Username and password are required'));
		}

		const result = await loginLocalAccount(credentials);
		if (!result.ok) {
			return err(result.error);
		}

		return ok(result.value.user);
	},

	async bootstrap(credentials: BootstrapCredentials): Promise<Result<CurrentUser, ApiError>> {
		if (!credentials.username || !credentials.password) {
			return err(ApiErrors.validation('Username and password are required'));
		}

		const result = await bootstrapLocalAccount(credentials);
		if (!result.ok) {
			return err(result.error);
		}

		return ok(result.value.user);
	},

	async restoreSession(): Promise<Result<CurrentUser, ApiError>> {
		const result = await getCurrentUser();
		if (!result.ok) {
			return err(result.error);
		}

		return ok(result.value.user);
	},

	async logout(): Promise<Result<void, ApiError>> {
		return logoutLocalAccount();
	},

	async logoutAllSessions(): Promise<Result<void, ApiError>> {
		return logoutAllLocalAccount();
	}
} as const;
