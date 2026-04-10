import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import type {
	CreateUserAccountInput,
	UserAccount
} from '$lib/server/domain/entities/UserAccount';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { users } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { eq, sql } from 'drizzle-orm';

function mapUserRow(row: {
	id: number;
	username: string;
	passwordHash: string;
	basicAuthPasswordHash: string | null;
	isDisabled: boolean;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
}): UserAccount {
	return {
		id: row.id,
		username: row.username,
		passwordHash: row.passwordHash,
		basicAuthPasswordHash: row.basicAuthPasswordHash,
		isDisabled: row.isDisabled,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		lastLoginAt: row.lastLoginAt
	};
}

const userSelection = {
	id: users.id,
	username: users.username,
	passwordHash: users.passwordHash,
	basicAuthPasswordHash: users.basicAuthPasswordHash,
	isDisabled: users.isDisabled,
	createdAt: users.createdAt,
	updatedAt: users.updatedAt,
	lastLoginAt: users.lastLoginAt
};

export class UserRepository implements UserRepositoryPort {
	private readonly repoLogger = createChildLogger({ repository: 'UserRepository' });

	async count(): Promise<number> {
		const [row] = await drizzleDb
			.select({ count: sql<number>`count(*)` })
			.from(users);

		return Number(row?.count ?? 0);
	}

	async getById(id: number): Promise<UserAccount | undefined> {
		const [row] = await drizzleDb.select(userSelection).from(users).where(eq(users.id, id)).limit(1);
		return row ? mapUserRow(row) : undefined;
	}

	async getByUsername(username: string): Promise<UserAccount | undefined> {
		const [row] = await drizzleDb
			.select(userSelection)
			.from(users)
			.where(eq(users.username, username))
			.limit(1);

		return row ? mapUserRow(row) : undefined;
	}

	async create(input: CreateUserAccountInput): Promise<UserAccount> {
		const now = new Date().toISOString();
		const [created] = await drizzleDb
			.insert(users)
			.values({
				username: input.username,
				passwordHash: input.passwordHash,
				createdAt: now,
				updatedAt: now
			})
			.returning(userSelection);

		if (!created) {
			throw new Error('Failed to create user');
		}

		this.repoLogger.info(
			{ event: 'auth.user.created', userId: created.id, username: created.username },
			'User account created'
		);

		return mapUserRow(created);
	}

	async setBasicAuthPasswordHash(userId: number, passwordHash: string | null, updatedAt: string): Promise<void> {
		await drizzleDb
			.update(users)
			.set({
				basicAuthPasswordHash: passwordHash,
				updatedAt
			})
			.where(eq(users.id, userId));
	}

	async touchLastLogin(id: number, at: string): Promise<void> {
		await drizzleDb
			.update(users)
			.set({
				lastLoginAt: at,
				updatedAt: at
			})
			.where(eq(users.id, id));
	}
}
