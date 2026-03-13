import type { DeviceProgressDownload } from '$lib/server/domain/entities/DeviceProgressDownload';

export interface DeviceProgressDownloadRepositoryPort {
	upsertByDeviceAndBook(
		input: Omit<DeviceProgressDownload, 'id'>
	): Promise<DeviceProgressDownload>;
	deleteByDeviceId(deviceId: string): Promise<void>;
}
