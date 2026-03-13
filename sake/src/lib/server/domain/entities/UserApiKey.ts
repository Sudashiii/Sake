export interface UserApiKey {
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
}

export interface CreateUserApiKeyInput {
	userId: number;
	deviceId: string;
	scope: string;
	keyPrefix: string;
	keyHash: string;
	createdAt: string;
	expiresAt?: string | null;
}
