import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import {
	createSessionToken,
	hashPassword
} from '$lib/server/application/services/LocalAuthService';
import { SAKE_SESSION_TTL_MS } from '$lib/server/auth/constants';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface BootstrapLocalAccountInput {
	username: string;
	password: string;
	userAgent?: string | null;
	ipAddress?: string | null;
}

interface BootstrapLocalAccountResult {
	success: true;
	user: {
		id: number;
		username: string;
		isDisabled: boolean;
		hasBasicAuthPassword: boolean;
		lastLoginAt: string | null;
		createdAt: string;
	};
	sessionToken: string;
	sessionExpiresAt: string;
}

function normalizeUsername(value: string): string {
	return value.trim();
}

export class BootstrapLocalAccountUseCase {
	constructor(
		private readonly userRepository: UserRepositoryPort,
		private readonly sessionRepository: UserSessionRepositoryPort
	) {}

	async execute(input: BootstrapLocalAccountInput): Promise<ApiResult<BootstrapLocalAccountResult>> {
		const username = normalizeUsername(input.username);
		const password = input.password;

		if (!username) {
			return apiError('Username is required', 400);
		}
		if (username.length < 3 || username.length > 64) {
			return apiError('Username must be between 3 and 64 characters', 400);
		}
		if (!password || password.length < 8) {
			return apiError('Password must be at least 8 characters', 400);
		}

		const userCount = await this.userRepository.count();
		if (userCount > 0) {
			return apiError('Registration is closed', 403);
		}

		const passwordHash = await hashPassword(password);
		const user = await this.userRepository.create({
			username,
			passwordHash
		});

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
				hasBasicAuthPassword: false,
				lastLoginAt: nowIso,
				createdAt: user.createdAt
			},
			sessionToken: token,
			sessionExpiresAt: expiresAt
		});
	}
}
