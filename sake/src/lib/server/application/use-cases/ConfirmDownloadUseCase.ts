import type { DeviceDownloadRepositoryPort } from '$lib/server/application/ports/DeviceDownloadRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { DeviceDownload } from '$lib/server/domain/entities/DeviceDownload';

interface ConfirmDownloadInput {
	deviceId: string;
	bookId: number;
}

export class ConfirmDownloadUseCase {
	constructor(private readonly deviceDownloadRepository: DeviceDownloadRepositoryPort) {}

	async execute(input: ConfirmDownloadInput): Promise<ApiResult<DeviceDownload>> {
		const download = await this.deviceDownloadRepository.create({
			deviceId: input.deviceId,
			bookId: input.bookId
		});
		return apiOk(download);
	}
}
