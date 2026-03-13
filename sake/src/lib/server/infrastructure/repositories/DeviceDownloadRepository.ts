import type { DeviceDownloadRepositoryPort } from '$lib/server/application/ports/DeviceDownloadRepositoryPort';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { deviceDownloads } from '$lib/server/infrastructure/db/schema';
import type { DeviceDownload } from '$lib/server/domain/entities/DeviceDownload';
import { and, eq } from 'drizzle-orm';

export class DeviceDownloadRepository implements DeviceDownloadRepositoryPort {
	private static readonly instance = new DeviceDownloadRepository();

	async getAll(): Promise<DeviceDownload[]> {
		return drizzleDb.select().from(deviceDownloads);
	}

	async getByDevice(deviceId: string): Promise<DeviceDownload[]> {
		return drizzleDb.select().from(deviceDownloads).where(eq(deviceDownloads.deviceId, deviceId));
	}

	async getByBookId(bookId: number): Promise<DeviceDownload[]> {
		return drizzleDb.select().from(deviceDownloads).where(eq(deviceDownloads.bookId, bookId));
	}

	async create(download: Omit<DeviceDownload, 'id'>): Promise<DeviceDownload> {
		const [created] = await drizzleDb.insert(deviceDownloads).values(download).returning();

		if (!created) {
			throw new Error('Failed to create device download');
		}

		return created;
	}

	async deleteByDeviceId(deviceId: string): Promise<void> {
		await drizzleDb.delete(deviceDownloads).where(eq(deviceDownloads.deviceId, deviceId));
	}

	async deleteByBookIdAndDeviceId(bookId: number, deviceId: string): Promise<void> {
		await drizzleDb
			.delete(deviceDownloads)
			.where(and(eq(deviceDownloads.bookId, bookId), eq(deviceDownloads.deviceId, deviceId)));
	}

	async delete(id: number): Promise<void> {
		await drizzleDb.delete(deviceDownloads).where(eq(deviceDownloads.id, id));
	}

	static async getAll(): Promise<DeviceDownload[]> {
		return DeviceDownloadRepository.instance.getAll();
	}

	static async getByDevice(deviceId: string): Promise<DeviceDownload[]> {
		return DeviceDownloadRepository.instance.getByDevice(deviceId);
	}

	static async getByBookId(bookId: number): Promise<DeviceDownload[]> {
		return DeviceDownloadRepository.instance.getByBookId(bookId);
	}

	static async create(download: Omit<DeviceDownload, 'id'>): Promise<DeviceDownload> {
		return DeviceDownloadRepository.instance.create(download);
	}

	static async deleteByDeviceId(deviceId: string): Promise<void> {
		return DeviceDownloadRepository.instance.deleteByDeviceId(deviceId);
	}

	static async deleteByBookIdAndDeviceId(bookId: number, deviceId: string): Promise<void> {
		return DeviceDownloadRepository.instance.deleteByBookIdAndDeviceId(bookId, deviceId);
	}

	static async delete(id: number): Promise<void> {
		return DeviceDownloadRepository.instance.delete(id);
	}
}
