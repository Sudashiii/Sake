import type { Device } from '$lib/server/domain/entities/Device';

export interface DeviceRepositoryPort {
	upsert(input: Omit<Device, 'id' | 'createdAt' | 'updatedAt' | 'lastSeenAt'>): Promise<Device>;
	listByUserId(userId: number): Promise<Device[]>;
	getByDeviceId(deviceId: string): Promise<Device | undefined>;
	getByUserIdAndDeviceId(userId: number, deviceId: string): Promise<Device | undefined>;
	deleteByUserIdAndDeviceId(userId: number, deviceId: string): Promise<boolean>;
}
