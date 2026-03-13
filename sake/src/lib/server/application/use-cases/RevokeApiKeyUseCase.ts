import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface RevokeApiKeyInput {
	userId: number;
	apiKeyId: number;
}

interface RevokeApiKeyResult {
	success: true;
}

export class RevokeApiKeyUseCase {
	constructor(private readonly apiKeyRepository: UserApiKeyRepositoryPort) {}

	async execute(input: RevokeApiKeyInput): Promise<ApiResult<RevokeApiKeyResult>> {
		const revoked = await this.apiKeyRepository.revokeById(
			input.userId,
			input.apiKeyId,
			new Date().toISOString()
		);

		if (!revoked) {
			return apiError('API key not found', 404);
		}

		return apiOk({ success: true });
	}
}
