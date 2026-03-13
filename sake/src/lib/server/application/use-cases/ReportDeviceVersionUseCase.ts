import type { DeviceRepositoryPort } from '$lib/server/application/ports/DeviceRepositoryPort';
import {
	isDeviceVersionTooLong,
	normalizeDeviceVersion
} from '$lib/server/application/services/deviceVersion';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface ReportDeviceVersionInput {
	userId: number;
	deviceId: string;
	version: string;
	skipIfUnchanged?: boolean;
}

interface ReportDeviceVersionResult {
	success: true;
	deviceId: string;
	version: string;
	reportedAt: string;
}

export class ReportDeviceVersionUseCase {
	constructor(private readonly deviceRepository: DeviceRepositoryPort) {}

	async execute(input: ReportDeviceVersionInput): Promise<ApiResult<ReportDeviceVersionResult>> {
		if (!Number.isInteger(input.userId) || input.userId <= 0) {
			return apiError('userId is required', 400);
		}

		const deviceId = input.deviceId.trim();
		const version = normalizeDeviceVersion(input.version);

		if (!deviceId || !version) {
			return apiError('deviceId and version are required', 400);
		}

		if (isDeviceVersionTooLong(version)) {
			return apiError('version is too long', 400);
		}

		const conflictingDevice = await this.deviceRepository.getByDeviceId(deviceId);
		if (conflictingDevice && conflictingDevice.userId !== input.userId) {
			return apiError(`deviceId "${deviceId}" is already registered to another account`, 409);
		}

		const existingDevice = await this.deviceRepository.getByUserIdAndDeviceId(input.userId, deviceId);
		if (input.skipIfUnchanged && existingDevice && existingDevice.pluginVersion === version) {
			return apiOk({
				success: true,
				deviceId: existingDevice.deviceId,
				version: existingDevice.pluginVersion,
				reportedAt: existingDevice.lastSeenAt
			});
		}

		const device = await this.deviceRepository.upsert({
			userId: input.userId,
			deviceId,
			pluginVersion: version
		});

		return apiOk({
			success: true,
			deviceId: device.deviceId,
			version: device.pluginVersion,
			reportedAt: device.lastSeenAt
		});
	}
}
