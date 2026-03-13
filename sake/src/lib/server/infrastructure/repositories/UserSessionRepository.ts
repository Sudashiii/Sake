import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import type {
	CreateUserSessionInput,
	UserSession
} from '$lib/server/domain/entities/UserSession';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { userSessions } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { and, eq, gt, isNull } from 'drizzle-orm';

const sessionSelection = {
	id: userSessions.id,
	userId: userSessions.userId,
	tokenHash: userSessions.tokenHash,
	createdAt: userSessions.createdAt,
	lastUsedAt: userSessions.lastUsedAt,
	expiresAt: userSessions.expiresAt,
	revokedAt: userSessions.revokedAt,
	userAgent: userSessions.userAgent,
	ipAddress: userSessions.ipAddress
};

function mapSessionRow(row: {
	id: number;
	userId: number;
	tokenHash: string;
	createdAt: string;
	lastUsedAt: string;
	expiresAt: string;
	revokedAt: string | null;
	userAgent: string | null;
	ipAddress: string | null;
}): UserSession {
	return {
		id: row.id,
		userId: row.userId,
		tokenHash: row.tokenHash,
		createdAt: row.createdAt,
		lastUsedAt: row.lastUsedAt,
		expiresAt: row.expiresAt,
		revokedAt: row.revokedAt,
		userAgent: row.userAgent,
		ipAddress: row.ipAddress
	};
}

export class UserSessionRepository implements UserSessionRepositoryPort {
	private readonly repoLogger = createChildLogger({ repository: 'UserSessionRepository' });

	async create(input: CreateUserSessionInput): Promise<UserSession> {
		const [created] = await drizzleDb
			.insert(userSessions)
			.values({
				userId: input.userId,
				tokenHash: input.tokenHash,
				createdAt: input.createdAt,
				lastUsedAt: input.lastUsedAt,
				expiresAt: input.expiresAt,
				userAgent: input.userAgent ?? null,
				ipAddress: input.ipAddress ?? null
			})
			.returning(sessionSelection);

		if (!created) {
			throw new Error('Failed to create session');
		}

		this.repoLogger.info(
			{ event: 'auth.session.created', sessionId: created.id, userId: created.userId },
			'User session created'
		);

		return mapSessionRow(created);
	}

	async getActiveByTokenHash(tokenHash: string, nowIso: string): Promise<UserSession | undefined> {
		const [row] = await drizzleDb
			.select(sessionSelection)
			.from(userSessions)
			.where(
				and(
					eq(userSessions.tokenHash, tokenHash),
					isNull(userSessions.revokedAt),
					gt(userSessions.expiresAt, nowIso)
				)
			)
			.limit(1);

		return row ? mapSessionRow(row) : undefined;
	}

	async touchLastUsed(id: number, at: string): Promise<void> {
		await drizzleDb
			.update(userSessions)
			.set({ lastUsedAt: at })
			.where(eq(userSessions.id, id));
	}

	async revokeByTokenHash(tokenHash: string, revokedAt: string): Promise<void> {
		await drizzleDb
			.update(userSessions)
			.set({ revokedAt })
			.where(and(eq(userSessions.tokenHash, tokenHash), isNull(userSessions.revokedAt)));
	}

	async revokeAllActiveByUserId(userId: number, revokedAt: string): Promise<void> {
		await drizzleDb
			.update(userSessions)
			.set({ revokedAt })
			.where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
	}
}
