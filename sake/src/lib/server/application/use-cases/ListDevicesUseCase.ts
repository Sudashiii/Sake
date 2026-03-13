import type { DeviceRepositoryPort } from '$lib/server/application/ports/DeviceRepositoryPort';
import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface ListDevicesInput {
	userId: number;
}

interface DeviceListItem {
	deviceId: string;
	pluginVersion: string;
	createdAt: string;
	updatedAt: string;
	lastSeenAt: string;
	hasActiveApiKey: boolean;
}

interface ListDevicesResult {
	success: true;
	devices: DeviceListItem[];
}

export class ListDevicesUseCase {
	constructor(
		private readonly deviceRepository: DeviceRepositoryPort,
		private readonly userApiKeyRepository: UserApiKeyRepositoryPort
	) {}

	async execute(input: ListDevicesInput): Promise<ApiResult<ListDevicesResult>> {
		const [devices, apiKeys] = await Promise.all([
			this.deviceRepository.listByUserId(input.userId),
			this.userApiKeyRepository.listActiveByUserId(input.userId)
		]);
		const deviceIdsWithActiveKeys = new Set(apiKeys.map((apiKey) => apiKey.deviceId));

		return apiOk({
			success: true,
			devices: devices.map((device) => ({
				deviceId: device.deviceId,
				pluginVersion: device.pluginVersion,
				createdAt: device.createdAt,
				updatedAt: device.updatedAt,
				lastSeenAt: device.lastSeenAt,
				hasActiveApiKey: deviceIdsWithActiveKeys.has(device.deviceId)
			}))
		});
	}
}
