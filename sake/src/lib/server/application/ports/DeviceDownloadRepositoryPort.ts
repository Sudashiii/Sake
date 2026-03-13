import type { DeviceDownload } from '$lib/server/domain/entities/DeviceDownload';

export interface DeviceDownloadRepositoryPort {
	getAll(): Promise<DeviceDownload[]>;
	getByDevice(deviceId: string): Promise<DeviceDownload[]>;
	getByBookId(bookId: number): Promise<DeviceDownload[]>;
	create(download: Omit<DeviceDownload, 'id'>): Promise<DeviceDownload>;
	deleteByDeviceId(deviceId: string): Promise<void>;
	deleteByBookIdAndDeviceId(bookId: number, deviceId: string): Promise<void>;
	delete(id: number): Promise<void>;
}
