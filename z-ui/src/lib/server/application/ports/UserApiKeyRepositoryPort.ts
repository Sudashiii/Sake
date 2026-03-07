import type {
	CreateUserApiKeyInput,
	UserApiKey
} from '$lib/server/domain/entities/UserApiKey';

export interface UserApiKeyRepositoryPort {
	create(input: CreateUserApiKeyInput): Promise<UserApiKey>;
	getActiveByKeyHash(keyHash: string, nowIso: string): Promise<UserApiKey | undefined>;
	listActiveByUserId(userId: number): Promise<UserApiKey[]>;
	revokeActiveByDeviceId(userId: number, deviceId: string, revokedAt: string): Promise<void>;
	revokeById(userId: number, id: number, revokedAt: string): Promise<boolean>;
	touchLastUsed(id: number, at: string): Promise<void>;
}
