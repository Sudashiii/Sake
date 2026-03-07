import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import type {
	CreateUserApiKeyInput,
	UserApiKey
} from '$lib/server/domain/entities/UserApiKey';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { userApiKeys } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';

const apiKeySelection = {
	id: userApiKeys.id,
	userId: userApiKeys.userId,
	deviceId: userApiKeys.deviceId,
	scope: userApiKeys.scope,
	keyPrefix: userApiKeys.keyPrefix,
	keyHash: userApiKeys.keyHash,
	createdAt: userApiKeys.createdAt,
	lastUsedAt: userApiKeys.lastUsedAt,
	expiresAt: userApiKeys.expiresAt,
	revokedAt: userApiKeys.revokedAt
};

function mapApiKeyRow(row: {
	id: number;
	userId: number;
	deviceId: string;
	scope: string;
	keyPrefix: string;
	keyHash: string;
	createdAt: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
	revokedAt: string | null;
}): UserApiKey {
	return {
		id: row.id,
		userId: row.userId,
		deviceId: row.deviceId,
		scope: row.scope,
		keyPrefix: row.keyPrefix,
		keyHash: row.keyHash,
		createdAt: row.createdAt,
		lastUsedAt: row.lastUsedAt,
		expiresAt: row.expiresAt,
		revokedAt: row.revokedAt
	};
}

export class UserApiKeyRepository implements UserApiKeyRepositoryPort {
	private readonly repoLogger = createChildLogger({ repository: 'UserApiKeyRepository' });

	async create(input: CreateUserApiKeyInput): Promise<UserApiKey> {
		const [created] = await drizzleDb
			.insert(userApiKeys)
			.values({
				userId: input.userId,
				deviceId: input.deviceId,
				scope: input.scope,
				keyPrefix: input.keyPrefix,
				keyHash: input.keyHash,
				createdAt: input.createdAt,
				expiresAt: input.expiresAt ?? null
			})
			.returning(apiKeySelection);

		if (!created) {
			throw new Error('Failed to create API key');
		}

		this.repoLogger.info(
			{
				event: 'auth.api_key.created',
				apiKeyId: created.id,
				userId: created.userId,
				deviceId: created.deviceId
			},
			'Device API key created'
		);

		return mapApiKeyRow(created);
	}

	async getActiveByKeyHash(keyHash: string, nowIso: string): Promise<UserApiKey | undefined> {
		const [row] = await drizzleDb
			.select(apiKeySelection)
			.from(userApiKeys)
			.where(
				and(
					eq(userApiKeys.keyHash, keyHash),
					isNull(userApiKeys.revokedAt),
					or(isNull(userApiKeys.expiresAt), gt(userApiKeys.expiresAt, nowIso))
				)
			)
			.limit(1);

		return row ? mapApiKeyRow(row) : undefined;
	}

	async listActiveByUserId(userId: number): Promise<UserApiKey[]> {
		const rows = await drizzleDb
			.select(apiKeySelection)
			.from(userApiKeys)
			.where(and(eq(userApiKeys.userId, userId), isNull(userApiKeys.revokedAt)))
			.orderBy(desc(userApiKeys.lastUsedAt), desc(userApiKeys.createdAt));

		return rows.map((row) => mapApiKeyRow(row));
	}

	async revokeActiveByDeviceId(userId: number, deviceId: string, revokedAt: string): Promise<void> {
		await drizzleDb
			.update(userApiKeys)
			.set({ revokedAt })
			.where(
				and(
					eq(userApiKeys.userId, userId),
					eq(userApiKeys.deviceId, deviceId),
					isNull(userApiKeys.revokedAt)
				)
			);
	}

	async revokeById(userId: number, id: number, revokedAt: string): Promise<boolean> {
		const [updated] = await drizzleDb
			.update(userApiKeys)
			.set({ revokedAt })
			.where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.id, id), isNull(userApiKeys.revokedAt)))
			.returning({ id: userApiKeys.id });

		return Boolean(updated);
	}

	async touchLastUsed(id: number, at: string): Promise<void> {
		await drizzleDb
			.update(userApiKeys)
			.set({ lastUsedAt: at })
			.where(eq(userApiKeys.id, id));
	}
}
