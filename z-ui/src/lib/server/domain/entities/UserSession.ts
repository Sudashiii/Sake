export interface UserSession {
	id: number;
	userId: number;
	tokenHash: string;
	createdAt: string;
	lastUsedAt: string;
	expiresAt: string;
	revokedAt: string | null;
	userAgent: string | null;
	ipAddress: string | null;
}

export interface CreateUserSessionInput {
	userId: number;
	tokenHash: string;
	createdAt: string;
	lastUsedAt: string;
	expiresAt: string;
	userAgent?: string | null;
	ipAddress?: string | null;
}
