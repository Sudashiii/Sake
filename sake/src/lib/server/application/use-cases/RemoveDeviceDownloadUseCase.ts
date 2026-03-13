import type { DeviceDownloadRepositoryPort } from '$lib/server/application/ports/DeviceDownloadRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface RemoveDeviceDownloadInput {
	bookId: number;
	deviceId: string;
}

interface RemoveDeviceDownloadResult {
	success: true;
}

export class RemoveDeviceDownloadUseCase {
	constructor(private readonly deviceDownloadRepository: DeviceDownloadRepositoryPort) {}

	async execute(input: RemoveDeviceDownloadInput): Promise<ApiResult<RemoveDeviceDownloadResult>> {
		await this.deviceDownloadRepository.deleteByBookIdAndDeviceId(input.bookId, input.deviceId);
		return apiOk({ success: true });
	}
}
