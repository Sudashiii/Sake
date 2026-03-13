import type { DeviceDownloadRepositoryPort } from '$lib/server/application/ports/DeviceDownloadRepositoryPort';
import type { DeviceProgressDownloadRepositoryPort } from '$lib/server/application/ports/DeviceProgressDownloadRepositoryPort';
import type { DeviceRepositoryPort } from '$lib/server/application/ports/DeviceRepositoryPort';
import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface DeleteDeviceInput {
	userId: number;
	deviceId: string;
}

interface DeleteDeviceResult {
	success: true;
	deviceId: string;
}

export class DeleteDeviceUseCase {
	constructor(
		private readonly deviceRepository: DeviceRepositoryPort,
		private readonly userApiKeyRepository: UserApiKeyRepositoryPort,
		private readonly deviceDownloadRepository: DeviceDownloadRepositoryPort,
		private readonly deviceProgressDownloadRepository: DeviceProgressDownloadRepositoryPort
	) {}

	async execute(input: DeleteDeviceInput): Promise<ApiResult<DeleteDeviceResult>> {
		if (!Number.isInteger(input.userId) || input.userId <= 0) {
			return apiError('userId is required', 400);
		}

		const deviceId = input.deviceId.trim();
		if (!deviceId) {
			return apiError('deviceId is required', 400);
		}

		const device = await this.deviceRepository.getByUserIdAndDeviceId(input.userId, deviceId);
		if (!device) {
			return apiError(`Device "${deviceId}" was not found`, 404);
		}

		const revokedAt = new Date().toISOString();
		await this.userApiKeyRepository.revokeActiveByDeviceId(input.userId, deviceId, revokedAt);
		await this.deviceDownloadRepository.deleteByDeviceId(deviceId);
		await this.deviceProgressDownloadRepository.deleteByDeviceId(deviceId);
		await this.deviceRepository.deleteByUserIdAndDeviceId(input.userId, deviceId);

		return apiOk({
			success: true,
			deviceId
		});
	}
}
