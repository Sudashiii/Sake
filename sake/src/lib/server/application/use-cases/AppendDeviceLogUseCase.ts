import type { DeviceLogFeedPort } from '$lib/server/application/ports/DeviceLogFeedPort';
import type { DeviceRepositoryPort } from '$lib/server/application/ports/DeviceRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { normalizeLogLevel } from '$lib/types/Logs/LogLevel';
import type { DeviceLogEntry } from '$lib/types/Logs/DeviceLogEntry';

interface AppendDeviceLogInput {
	userId: number;
	deviceId: string;
	timestamp: string;
	level: string;
	message: string;
	source: string;
}

function normalizeTimestamp(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
}

export class AppendDeviceLogUseCase {
	constructor(
		private readonly deviceRepository: DeviceRepositoryPort,
		private readonly deviceLogFeed: DeviceLogFeedPort
	) {}

	async execute(input: AppendDeviceLogInput): Promise<ApiResult<DeviceLogEntry>> {
		const deviceId = input.deviceId.trim();
		const level = input.level.trim();
		const message = input.message.trim();
		const source = input.source.trim();
		const timestamp = normalizeTimestamp(input.timestamp);

		if (!deviceId || !timestamp || !level || !message || !source) {
			return apiError('deviceId, timestamp, level, message, and source are required', 400);
		}

		const device = await this.deviceRepository.getByUserIdAndDeviceId(input.userId, deviceId);
		if (!device) {
			return apiError(`Device "${deviceId}" was not found`, 404);
		}

		return apiOk(
			this.deviceLogFeed.append({
				deviceId,
				timestamp,
				level: normalizeLogLevel(level),
				message,
				source
			})
		);
	}
}
