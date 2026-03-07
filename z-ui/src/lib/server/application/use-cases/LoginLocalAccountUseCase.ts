import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import {
	createSessionToken,
	verifyPassword
} from '$lib/server/application/services/LocalAuthService';
import { SAKE_SESSION_TTL_MS } from '$lib/server/auth/constants';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface LoginLocalAccountInput {
	username: string;
	password: string;
	userAgent?: string | null;
	ipAddress?: string | null;
}

interface LoginLocalAccountResult {
	success: true;
	user: {
		id: number;
		username: string;
		isDisabled: boolean;
		lastLoginAt: string | null;
		createdAt: string;
	};
	sessionToken: string;
	sessionExpiresAt: string;
}

export class LoginLocalAccountUseCase {
	constructor(
		private readonly userRepository: UserRepositoryPort,
		private readonly sessionRepository: UserSessionRepositoryPort
	) {}

	async execute(input: LoginLocalAccountInput): Promise<ApiResult<LoginLocalAccountResult>> {
		const username = input.username.trim();
		const password = input.password;

		if (!username || !password) {
			return apiError('Username and password are required', 400);
		}

		const user = await this.userRepository.getByUsername(username);
		if (!user) {
			return apiError('Invalid username or password', 401);
		}
		if (user.isDisabled) {
			return apiError('Account is disabled', 403);
		}

		const passwordMatches = await verifyPassword(password, user.passwordHash);
		if (!passwordMatches) {
			return apiError('Invalid username or password', 401);
		}

		const now = new Date();
		const { token, tokenHash } = createSessionToken();
		const expiresAt = new Date(now.getTime() + SAKE_SESSION_TTL_MS).toISOString();
		const nowIso = now.toISOString();

		await this.sessionRepository.create({
			userId: user.id,
			tokenHash,
			createdAt: nowIso,
			lastUsedAt: nowIso,
			expiresAt,
			userAgent: input.userAgent ?? null,
			ipAddress: input.ipAddress ?? null
		});
		await this.userRepository.touchLastLogin(user.id, nowIso);

		return apiOk({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				isDisabled: user.isDisabled,
				lastLoginAt: nowIso,
				createdAt: user.createdAt
			},
			sessionToken: token,
			sessionExpiresAt: expiresAt
		});
	}
}
