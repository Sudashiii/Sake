import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { GetAuthStatusUseCase } from '$lib/server/application/use-cases/GetAuthStatusUseCase';
import { BootstrapLocalAccountUseCase } from '$lib/server/application/use-cases/BootstrapLocalAccountUseCase';
import { LoginLocalAccountUseCase } from '$lib/server/application/use-cases/LoginLocalAccountUseCase';
import { GetCurrentUserUseCase } from '$lib/server/application/use-cases/GetCurrentUserUseCase';
import { SetBasicAuthPasswordUseCase } from '$lib/server/application/use-cases/SetBasicAuthPasswordUseCase';
import { ClearBasicAuthPasswordUseCase } from '$lib/server/application/use-cases/ClearBasicAuthPasswordUseCase';
import { LogoutLocalAccountUseCase } from '$lib/server/application/use-cases/LogoutLocalAccountUseCase';
import { LogoutAllLocalSessionsUseCase } from '$lib/server/application/use-cases/LogoutAllLocalSessionsUseCase';
import { CreateDeviceApiKeyUseCase } from '$lib/server/application/use-cases/CreateDeviceApiKeyUseCase';
import { RevokeApiKeyUseCase } from '$lib/server/application/use-cases/RevokeApiKeyUseCase';
import { ResolveRequestAuthUseCase } from '$lib/server/application/use-cases/ResolveRequestAuthUseCase';
import { hashPassword } from '$lib/server/application/services/LocalAuthService';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';
import { buildRateLimitKeyPart, enforceAuthRateLimits, resetAuthRateLimitsForTests } from '$lib/server/auth/rateLimit';
import { isApiKeyAllowedRoute } from '$lib/server/auth/requestAccess';
import { SAKE_DEVICE_API_KEY_SCOPE } from '$lib/server/auth/constants';
import type { DeviceRepositoryPort } from '$lib/server/application/ports/DeviceRepositoryPort';
import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import type { Device } from '$lib/server/domain/entities/Device';
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
			basicAuthPasswordHash: null,
			isDisabled: false,
			createdAt: now,
			updatedAt: now,
			lastLoginAt: null
		};
		this.users.push(user);
		return user;
	}

	async setBasicAuthPasswordHash(userId: number, passwordHash: string | null, updatedAt: string): Promise<void> {
		const user = this.users.find((entry) => entry.id === userId);
		if (!user) {
			return;
		}

		user.basicAuthPasswordHash = passwordHash;
		user.updatedAt = updatedAt;
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

	async revokeAllActiveByUserId(userId: number, revokedAt: string): Promise<void> {
		for (const session of this.sessions) {
			if (session.userId === userId && session.revokedAt === null) {
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

class InMemoryDeviceRepository implements DeviceRepositoryPort {
	private readonly devices: Device[] = [];
	private nextId = 1;

	async upsert(input: Omit<Device, 'id' | 'createdAt' | 'updatedAt' | 'lastSeenAt'>): Promise<Device> {
		const now = new Date().toISOString();
		const existing = this.devices.find(
			(device) => device.userId === input.userId && device.deviceId === input.deviceId
		);

		if (existing) {
			existing.pluginVersion = input.pluginVersion;
			existing.updatedAt = now;
			existing.lastSeenAt = now;
			return existing;
		}

		const created: Device = {
			id: this.nextId++,
			userId: input.userId,
			deviceId: input.deviceId,
			pluginVersion: input.pluginVersion,
			createdAt: now,
			updatedAt: now,
			lastSeenAt: now
		};
		this.devices.push(created);
		return created;
	}

	async listByUserId(userId: number): Promise<Device[]> {
		return this.devices.filter((device) => device.userId === userId);
	}

	async getByDeviceId(deviceId: string): Promise<Device | undefined> {
		return this.devices.find((device) => device.deviceId === deviceId);
	}

	async getByUserIdAndDeviceId(userId: number, deviceId: string): Promise<Device | undefined> {
		return this.devices.find((device) => device.userId === userId && device.deviceId === deviceId);
	}

	async deleteByUserIdAndDeviceId(userId: number, deviceId: string): Promise<boolean> {
		const index = this.devices.findIndex(
			(device) => device.userId === userId && device.deviceId === deviceId
		);
		if (index < 0) {
			return false;
		}
		this.devices.splice(index, 1);
		return true;
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
		assert.equal(currentUser.user.hasBasicAuthPassword, false);
	});

	test('basic auth password can be set and cleared independently from the account password', async () => {
		const users = new InMemoryUserRepository();
		const currentUserUseCase = new GetCurrentUserUseCase(users);
		const setBasicAuthPasswordUseCase = new SetBasicAuthPasswordUseCase(users);
		const clearBasicAuthPasswordUseCase = new ClearBasicAuthPasswordUseCase(users);
		const { user } = await seedUser(users);

		const initialCurrentUser = expectOk(await currentUserUseCase.execute({ userId: user.id }));
		assert.equal(initialCurrentUser.user.hasBasicAuthPassword, false);

		const setResult = expectOk(
			await setBasicAuthPasswordUseCase.execute({
				userId: user.id,
				password: 'separate-basic-auth-123'
			})
		);
		assert.equal(setResult.hasBasicAuthPassword, true);

		const afterSet = expectOk(await currentUserUseCase.execute({ userId: user.id }));
		assert.equal(afterSet.user.hasBasicAuthPassword, true);

		const clearResult = expectOk(
			await clearBasicAuthPasswordUseCase.execute({
				userId: user.id
			})
		);
		assert.equal(clearResult.hasBasicAuthPassword, false);

		const afterClear = expectOk(await currentUserUseCase.execute({ userId: user.id }));
		assert.equal(afterClear.user.hasBasicAuthPassword, false);
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

	test('logout all revokes every active session for the user', async () => {
		const users = new InMemoryUserRepository();
		const sessions = new InMemoryUserSessionRepository();
		const apiKeys = new InMemoryUserApiKeyRepository();
		const loginUseCase = new LoginLocalAccountUseCase(users, sessions);
		const logoutAllUseCase = new LogoutAllLocalSessionsUseCase(sessions);
		const resolveAuthUseCase = new ResolveRequestAuthUseCase(users, sessions, apiKeys);
		const { password } = await seedUser(users);

		const firstLogin = expectOk(
			await loginUseCase.execute({
				username: 'admin',
				password,
				userAgent: 'browser-one',
				ipAddress: '127.0.0.1'
			})
		);
		const secondLogin = expectOk(
			await loginUseCase.execute({
				username: 'admin',
				password,
				userAgent: 'browser-two',
				ipAddress: '127.0.0.2'
			})
		);

		const firstActorBefore = await resolveAuthUseCase.execute({
			sessionToken: firstLogin.sessionToken
		});
		const secondActorBefore = await resolveAuthUseCase.execute({
			sessionToken: secondLogin.sessionToken
		});
		assert.equal(firstActorBefore?.type, 'session');
		assert.equal(secondActorBefore?.type, 'session');

		expectOk(await logoutAllUseCase.execute({ userId: firstActorBefore!.user.id }));

		const firstActorAfter = await resolveAuthUseCase.execute({
			sessionToken: firstLogin.sessionToken
		});
		const secondActorAfter = await resolveAuthUseCase.execute({
			sessionToken: secondLogin.sessionToken
		});
		assert.equal(firstActorAfter, null);
		assert.equal(secondActorAfter, null);
	});

	test('device API key flow supports pairing, access resolution, and revocation', async () => {
		const users = new InMemoryUserRepository();
		const sessions = new InMemoryUserSessionRepository();
		const apiKeys = new InMemoryUserApiKeyRepository();
		const devices = new InMemoryDeviceRepository();
		const { user, password } = await seedUser(users);
		const createDeviceApiKeyUseCase = new CreateDeviceApiKeyUseCase(users, apiKeys, devices);
		const revokeApiKeyUseCase = new RevokeApiKeyUseCase(apiKeys);
		const resolveAuthUseCase = new ResolveRequestAuthUseCase(users, sessions, apiKeys);

		const deviceKeyResult = expectOk(
			await createDeviceApiKeyUseCase.execute({
				username: user.username,
				password,
				deviceId: 'kindle-paperwhite',
				pluginVersion: '0.6.1'
			})
		);
		assert.equal(deviceKeyResult.deviceId, 'kindle-paperwhite');
		assert.match(deviceKeyResult.apiKey, /^sake_/);

		const storedDevice = await devices.getByUserIdAndDeviceId(user.id, 'kindle-paperwhite');
		assert.ok(storedDevice);
		assert.equal(storedDevice?.pluginVersion, '0.6.1');

		await devices.upsert({
			userId: user.id,
			deviceId: 'kindle-paperwhite',
			pluginVersion: '0.7.1'
		});

		const refreshedDeviceKeyResult = expectOk(
			await createDeviceApiKeyUseCase.execute({
				username: user.username,
				password,
				deviceId: 'kindle-paperwhite',
				pluginVersion: '0.7.1'
			})
		);

		const storedDeviceAfterRefresh = await devices.getByUserIdAndDeviceId(user.id, 'kindle-paperwhite');
		assert.equal(storedDeviceAfterRefresh?.pluginVersion, '0.7.1');

		const actorBeforeRevoke = await resolveAuthUseCase.execute({
			apiKey: refreshedDeviceKeyResult.apiKey
		});
		assert.equal(actorBeforeRevoke?.type, 'api_key');
		assert.equal(actorBeforeRevoke?.deviceId, 'kindle-paperwhite');
		assert.equal(actorBeforeRevoke?.scope, SAKE_DEVICE_API_KEY_SCOPE);

		const resolvedBoundDevice = resolveAuthorizedDeviceId(
			{ auth: actorBeforeRevoke ?? undefined },
			null,
			{ required: true }
		);
		assert.deepEqual(resolvedBoundDevice, {
			ok: true,
			deviceId: 'kindle-paperwhite'
		});

		const rejectedMismatchedDevice = resolveAuthorizedDeviceId(
			{ auth: actorBeforeRevoke ?? undefined },
			'other-device',
			{ required: true }
		);
		assert.equal(rejectedMismatchedDevice.ok, false);
		if (!rejectedMismatchedDevice.ok) {
			assert.equal(rejectedMismatchedDevice.status, 403);
			assert.equal(rejectedMismatchedDevice.message, 'API key is not allowed for this device');
		}

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
			apiKey: refreshedDeviceKeyResult.apiKey
		});
		assert.equal(actorAfterRevoke, null);
	});

	test('device ids cannot be registered by multiple users', async () => {
		const users = new InMemoryUserRepository();
		const apiKeys = new InMemoryUserApiKeyRepository();
		const devices = new InMemoryDeviceRepository();
		const sharedPassword = 'supersecret123';
		const sharedPasswordHash = await hashPassword(sharedPassword);
		const first = {
			user: await users.create({
				username: 'alpha',
				passwordHash: sharedPasswordHash
			}),
			password: sharedPassword
		};
		const second = {
			user: await users.create({
				username: 'beta',
				passwordHash: sharedPasswordHash
			}),
			password: sharedPassword
		};
		const createDeviceApiKeyUseCase = new CreateDeviceApiKeyUseCase(users, apiKeys, devices);

		expectOk(
			await createDeviceApiKeyUseCase.execute({
				username: first.user.username,
				password: first.password,
				deviceId: 'shared-kindle',
				pluginVersion: '0.6.1'
			})
		);

		const duplicateResult = await createDeviceApiKeyUseCase.execute({
			username: second.user.username,
			password: second.password,
			deviceId: 'shared-kindle',
			pluginVersion: '0.6.1'
		});

		assert.equal(duplicateResult.ok, false);
		if (!duplicateResult.ok) {
			assert.equal(duplicateResult.error.status, 409);
			assert.equal(
				duplicateResult.error.message,
				'deviceId "shared-kindle" is already registered to another account'
			);
		}
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
