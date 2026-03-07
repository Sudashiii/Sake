import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { GetAuthStatusUseCase } from '$lib/server/application/use-cases/GetAuthStatusUseCase';
import { BootstrapLocalAccountUseCase } from '$lib/server/application/use-cases/BootstrapLocalAccountUseCase';
import { LoginLocalAccountUseCase } from '$lib/server/application/use-cases/LoginLocalAccountUseCase';
import { GetCurrentUserUseCase } from '$lib/server/application/use-cases/GetCurrentUserUseCase';
import { LogoutLocalAccountUseCase } from '$lib/server/application/use-cases/LogoutLocalAccountUseCase';
import { CreateDeviceApiKeyUseCase } from '$lib/server/application/use-cases/CreateDeviceApiKeyUseCase';
import { RevokeApiKeyUseCase } from '$lib/server/application/use-cases/RevokeApiKeyUseCase';
import { ResolveRequestAuthUseCase } from '$lib/server/application/use-cases/ResolveRequestAuthUseCase';
import { hashPassword } from '$lib/server/application/services/LocalAuthService';
import { buildRateLimitKeyPart, enforceAuthRateLimits, resetAuthRateLimitsForTests } from '$lib/server/auth/rateLimit';
import { isApiKeyAllowedRoute } from '$lib/server/auth/requestAccess';
import { SAKE_DEVICE_API_KEY_SCOPE } from '$lib/server/auth/constants';
import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import type { UserAccount, CreateUserAccountInput } from '$lib/server/domain/entities/UserAccount';
import type { UserSession, CreateUserSessionInput } from '$lib/server/domain/entities/UserSession';
import type { UserApiKey, CreateUserApiKeyInput } from '$lib/server/domain/entities/UserApiKey';
import type { ApiResult } from '$lib/server/http/api';

class InMemoryUserRepository implements UserRepositoryPort {
	private readonly users: UserAccount[] = [];
	private nextId = 1;

	async count(): Promise<number> {
		return this.users.length;
	}

	async getById(id: number): Promise<UserAccount | undefined> {
		return this.users.find((user) => user.id === id);
	}

	async getByUsername(username: string): Promise<UserAccount | undefined> {
		return this.users.find((user) => user.username === username);
	}

	async create(input: CreateUserAccountInput): Promise<UserAccount> {
		const now = new Date().toISOString();
		const user: UserAccount = {
			id: this.nextId++,
			username: input.username,
			passwordHash: input.passwordHash,
			isDisabled: false,
			createdAt: now,
			updatedAt: now,
			lastLoginAt: null
		};
		this.users.push(user);
		return user;
	}

	async touchLastLogin(id: number, at: string): Promise<void> {
		const user = this.users.find((entry) => entry.id === id);
		if (!user) {
			return;
		}

		user.lastLoginAt = at;
		user.updatedAt = at;
	}
}

class InMemoryUserSessionRepository implements UserSessionRepositoryPort {
	private readonly sessions: UserSession[] = [];
	private nextId = 1;

	async create(input: CreateUserSessionInput): Promise<UserSession> {
		const session: UserSession = {
			id: this.nextId++,
			userId: input.userId,
			tokenHash: input.tokenHash,
			createdAt: input.createdAt,
			lastUsedAt: input.lastUsedAt,
			expiresAt: input.expiresAt,
			revokedAt: null,
			userAgent: input.userAgent ?? null,
			ipAddress: input.ipAddress ?? null
		};
		this.sessions.push(session);
		return session;
	}

	async getActiveByTokenHash(tokenHash: string, nowIso: string): Promise<UserSession | undefined> {
		return this.sessions.find(
			(session) => session.tokenHash === tokenHash && session.revokedAt === null && session.expiresAt > nowIso
		);
	}

	async touchLastUsed(id: number, at: string): Promise<void> {
		const session = this.sessions.find((entry) => entry.id === id);
		if (session) {
			session.lastUsedAt = at;
		}
	}

	async revokeByTokenHash(tokenHash: string, revokedAt: string): Promise<void> {
		for (const session of this.sessions) {
			if (session.tokenHash === tokenHash && session.revokedAt === null) {
				session.revokedAt = revokedAt;
			}
		}
	}
}

class InMemoryUserApiKeyRepository implements UserApiKeyRepositoryPort {
	private readonly apiKeys: UserApiKey[] = [];
	private nextId = 1;

	async create(input: CreateUserApiKeyInput): Promise<UserApiKey> {
		const apiKey: UserApiKey = {
			id: this.nextId++,
			userId: input.userId,
			deviceId: input.deviceId,
			scope: input.scope,
			keyPrefix: input.keyPrefix,
			keyHash: input.keyHash,
			createdAt: input.createdAt,
			lastUsedAt: null,
			expiresAt: input.expiresAt ?? null,
			revokedAt: null
		};
		this.apiKeys.push(apiKey);
		return apiKey;
	}

	async getActiveByKeyHash(keyHash: string, nowIso: string): Promise<UserApiKey | undefined> {
		return this.apiKeys.find(
			(apiKey) =>
				apiKey.keyHash === keyHash &&
				apiKey.revokedAt === null &&
				(apiKey.expiresAt === null || apiKey.expiresAt > nowIso)
		);
	}

	async listActiveByUserId(userId: number): Promise<UserApiKey[]> {
		return this.apiKeys.filter((apiKey) => apiKey.userId === userId && apiKey.revokedAt === null);
	}

	async revokeActiveByDeviceId(userId: number, deviceId: string, revokedAt: string): Promise<void> {
		for (const apiKey of this.apiKeys) {
			if (apiKey.userId === userId && apiKey.deviceId === deviceId && apiKey.revokedAt === null) {
				apiKey.revokedAt = revokedAt;
			}
		}
	}

	async revokeById(userId: number, id: number, revokedAt: string): Promise<boolean> {
		const apiKey = this.apiKeys.find(
			(entry) => entry.userId === userId && entry.id === id && entry.revokedAt === null
		);
		if (!apiKey) {
			return false;
		}

		apiKey.revokedAt = revokedAt;
		return true;
	}

	async touchLastUsed(id: number, at: string): Promise<void> {
		const apiKey = this.apiKeys.find((entry) => entry.id === id);
		if (apiKey) {
			apiKey.lastUsedAt = at;
		}
	}
}

function expectOk<T>(result: ApiResult<T>): T {
	assert.equal(result.ok, true);
	return result.value;
}

async function seedUser(userRepository: InMemoryUserRepository, username = 'admin', password = 'supersecret123') {
	const passwordHash = await hashPassword(password);
	const user = await userRepository.create({
		username,
		passwordHash
	});
	return { user, password };
}

describe('auth cleanup regression coverage', () => {
	beforeEach(() => {
		resetAuthRateLimitsForTests();
	});

	test('bootstrap creates the first account and closes registration', async () => {
		const users = new InMemoryUserRepository();
		const sessions = new InMemoryUserSessionRepository();
		const statusUseCase = new GetAuthStatusUseCase(users);
		const bootstrapUseCase = new BootstrapLocalAccountUseCase(users, sessions);
		const currentUserUseCase = new GetCurrentUserUseCase(users);

		const initialStatus = expectOk(await statusUseCase.execute());
		assert.equal(initialStatus.needsBootstrap, true);
		assert.equal(initialStatus.registrationOpen, true);

		const bootstrapResult = expectOk(
			await bootstrapUseCase.execute({
				username: 'admin',
				password: 'supersecret123',
				userAgent: 'test-suite',
				ipAddress: '127.0.0.1'
			})
		);
		assert.equal(bootstrapResult.user.username, 'admin');
		assert.notEqual(bootstrapResult.sessionToken, '');

		const statusAfterBootstrap = expectOk(await statusUseCase.execute());
		assert.equal(statusAfterBootstrap.needsBootstrap, false);
		assert.equal(statusAfterBootstrap.registrationOpen, false);

		const currentUser = expectOk(await currentUserUseCase.execute({ userId: bootstrapResult.user.id }));
		assert.equal(currentUser.user.username, 'admin');
	});

	test('login creates a session and logout revokes it', async () => {
		const users = new InMemoryUserRepository();
		const sessions = new InMemoryUserSessionRepository();
		const apiKeys = new InMemoryUserApiKeyRepository();
		const { user, password } = await seedUser(users);
		const loginUseCase = new LoginLocalAccountUseCase(users, sessions);
		const logoutUseCase = new LogoutLocalAccountUseCase(sessions);
		const resolveAuthUseCase = new ResolveRequestAuthUseCase(users, sessions, apiKeys);

		const loginResult = expectOk(
			await loginUseCase.execute({
				username: user.username,
				password,
				userAgent: 'test-suite',
				ipAddress: '127.0.0.1'
			})
		);

		const actorBeforeLogout = await resolveAuthUseCase.execute({
			sessionToken: loginResult.sessionToken
		});
		assert.equal(actorBeforeLogout?.type, 'session');
		assert.equal(actorBeforeLogout?.user.id, user.id);

		expectOk(await logoutUseCase.execute({ sessionToken: loginResult.sessionToken }));

		const actorAfterLogout = await resolveAuthUseCase.execute({
			sessionToken: loginResult.sessionToken
		});
		assert.equal(actorAfterLogout, null);
	});

	test('device API key flow supports pairing, access resolution, and revocation', async () => {
		const users = new InMemoryUserRepository();
		const sessions = new InMemoryUserSessionRepository();
		const apiKeys = new InMemoryUserApiKeyRepository();
		const { user, password } = await seedUser(users);
		const createDeviceApiKeyUseCase = new CreateDeviceApiKeyUseCase(users, apiKeys);
		const revokeApiKeyUseCase = new RevokeApiKeyUseCase(apiKeys);
		const resolveAuthUseCase = new ResolveRequestAuthUseCase(users, sessions, apiKeys);

		const deviceKeyResult = expectOk(
			await createDeviceApiKeyUseCase.execute({
				username: user.username,
				password,
				deviceId: 'kindle-paperwhite'
			})
		);
		assert.equal(deviceKeyResult.deviceId, 'kindle-paperwhite');
		assert.match(deviceKeyResult.apiKey, /^sake_/);

		const actorBeforeRevoke = await resolveAuthUseCase.execute({
			apiKey: deviceKeyResult.apiKey
		});
		assert.equal(actorBeforeRevoke?.type, 'api_key');
		assert.equal(actorBeforeRevoke?.deviceId, 'kindle-paperwhite');
		assert.equal(actorBeforeRevoke?.scope, SAKE_DEVICE_API_KEY_SCOPE);

		assert.equal(isApiKeyAllowedRoute('/api/plugin/koreader/latest', 'GET'), true);
		assert.equal(isApiKeyAllowedRoute('/api/plugin/koreader/download', 'GET'), true);
		assert.equal(isApiKeyAllowedRoute('/api/library/The Book.epub', 'GET'), true);
		assert.equal(isApiKeyAllowedRoute('/api/auth/me', 'GET'), false);
		assert.equal(isApiKeyAllowedRoute('/api/library/trash', 'GET'), false);

		expectOk(
			await revokeApiKeyUseCase.execute({
				userId: user.id,
				apiKeyId: actorBeforeRevoke!.apiKeyId
			})
		);

		const actorAfterRevoke = await resolveAuthUseCase.execute({
			apiKey: deviceKeyResult.apiKey
		});
		assert.equal(actorAfterRevoke, null);
	});

	test('auth rate limiter returns 429 after repeated attempts', async () => {
		const attempts = [
			{
				policyName: 'loginIp' as const,
				key: buildRateLimitKeyPart('127.0.0.1', 'unknown-ip')
			}
		];

		for (let index = 0; index < 10; index += 1) {
			assert.equal(enforceAuthRateLimits(attempts), null);
		}

		const response = enforceAuthRateLimits(attempts);
		assert.ok(response instanceof Response);
		assert.equal(response.status, 429);
		assert.notEqual(response.headers.get('Retry-After'), null);
	});
});
