import type { DeviceRepositoryPort } from '$lib/server/application/ports/DeviceRepositoryPort';
import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import {
	createApiKey,
	verifyPassword
} from '$lib/server/application/services/LocalAuthService';
import {
	isDeviceVersionTooLong,
	normalizeDeviceVersion
} from '$lib/server/application/services/deviceVersion';
import { SAKE_DEVICE_API_KEY_SCOPE } from '$lib/server/auth/constants';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

const UNKNOWN_DEVICE_PLUGIN_VERSION = 'unknown';

interface CreateDeviceApiKeyInput {
	username: string;
	password: string;
	deviceId: string;
	pluginVersion?: string | null;
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
		private readonly apiKeyRepository: UserApiKeyRepositoryPort,
		private readonly deviceRepository: DeviceRepositoryPort
	) {}

	async execute(input: CreateDeviceApiKeyInput): Promise<ApiResult<CreateDeviceApiKeyResult>> {
		const username = input.username.trim();
		const password = input.password;
		const deviceId = input.deviceId.trim();
		const pluginVersion = normalizeDeviceVersion(input.pluginVersion);

		if (!username || !password || !deviceId) {
			return apiError('username, password, and deviceId are required', 400);
		}

		if (pluginVersion && isDeviceVersionTooLong(pluginVersion)) {
			return apiError('version is too long', 400);
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

		const conflictingDevice = await this.deviceRepository.getByDeviceId(deviceId);
		if (conflictingDevice && conflictingDevice.userId !== user.id) {
			return apiError(`deviceId "${deviceId}" is already registered to another account`, 409);
		}

		const nowIso = new Date().toISOString();
		await this.apiKeyRepository.revokeActiveByDeviceId(user.id, deviceId, nowIso);

		const existingDevice = await this.deviceRepository.getByUserIdAndDeviceId(user.id, deviceId);
		await this.deviceRepository.upsert({
			userId: user.id,
			deviceId,
			pluginVersion: pluginVersion || existingDevice?.pluginVersion || UNKNOWN_DEVICE_PLUGIN_VERSION
		});

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
