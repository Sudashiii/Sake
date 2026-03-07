import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface ListActiveApiKeysInput {
	userId: number;
}

interface ListActiveApiKeysResult {
	success: true;
	apiKeys: {
		id: number;
		deviceId: string;
		keyPreview: string;
		createdAt: string;
		lastUsedAt: string | null;
		expiresAt: string | null;
	}[];
}

export class ListActiveApiKeysUseCase {
	constructor(private readonly apiKeyRepository: UserApiKeyRepositoryPort) {}

	async execute(input: ListActiveApiKeysInput): Promise<ApiResult<ListActiveApiKeysResult>> {
		const apiKeys = await this.apiKeyRepository.listActiveByUserId(input.userId);

		return apiOk({
			success: true,
			apiKeys: apiKeys.map((apiKey) => ({
				id: apiKey.id,
				deviceId: apiKey.deviceId,
				keyPreview: `${apiKey.keyPrefix}••••••••`,
				createdAt: apiKey.createdAt,
				lastUsedAt: apiKey.lastUsedAt,
				expiresAt: apiKey.expiresAt
			}))
		});
	}
}
