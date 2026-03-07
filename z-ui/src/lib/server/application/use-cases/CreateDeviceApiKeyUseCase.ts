import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import {
	createApiKey,
	verifyPassword
} from '$lib/server/application/services/LocalAuthService';
import { SAKE_DEVICE_API_KEY_SCOPE } from '$lib/server/auth/constants';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface CreateDeviceApiKeyInput {
	username: string;
	password: string;
	deviceId: string;
}

interface CreateDeviceApiKeyResult {
	success: true;
	apiKey: string;
	keyPrefix: string;
	deviceId: string;
}

export class CreateDeviceApiKeyUseCase {
	constructor(
		private readonly userRepository: UserRepositoryPort,
		private readonly apiKeyRepository: UserApiKeyRepositoryPort
	) {}

	async execute(input: CreateDeviceApiKeyInput): Promise<ApiResult<CreateDeviceApiKeyResult>> {
		const username = input.username.trim();
		const password = input.password;
		const deviceId = input.deviceId.trim();

		if (!username || !password || !deviceId) {
			return apiError('username, password, and deviceId are required', 400);
		}

		const user = await this.userRepository.getByUsername(username);
		if (!user) {
			return apiError('Invalid username or password', 401);
		}
		if (user.isDisabled) {
			return apiError('Account is disabled', 403);
		}

		const passwordMatches = await verifyPassword(password, user.passwordHash);
		if (!passwordMatches) {
			return apiError('Invalid username or password', 401);
		}

		const nowIso = new Date().toISOString();
		await this.apiKeyRepository.revokeActiveByDeviceId(user.id, deviceId, nowIso);

		const { key, keyHash, keyPrefix } = createApiKey();
		await this.apiKeyRepository.create({
			userId: user.id,
			deviceId,
			scope: SAKE_DEVICE_API_KEY_SCOPE,
			keyPrefix,
			keyHash,
			createdAt: nowIso
		});

		return apiOk({
			success: true,
			apiKey: key,
			keyPrefix,
			deviceId
		});
	}
}
