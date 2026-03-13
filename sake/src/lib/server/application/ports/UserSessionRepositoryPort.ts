import type {
	CreateUserSessionInput,
	UserSession
} from '$lib/server/domain/entities/UserSession';

export interface UserSessionRepositoryPort {
	create(input: CreateUserSessionInput): Promise<UserSession>;
	getActiveByTokenHash(tokenHash: string, nowIso: string): Promise<UserSession | undefined>;
	touchLastUsed(id: number, at: string): Promise<void>;
	revokeByTokenHash(tokenHash: string, revokedAt: string): Promise<void>;
	revokeAllActiveByUserId(userId: number, revokedAt: string): Promise<void>;
}
