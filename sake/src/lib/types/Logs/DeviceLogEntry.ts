import type { LogLevel } from './LogLevel';

export const DEVICE_LOG_BACKLOG_LIMIT = 500;

export interface DeviceLogEntry {
	id: string;
	deviceId: string;
	timestamp: string;
	level: LogLevel;
	message: string;
	source: string;
}

export interface DeviceLogSnapshot {
	entries: DeviceLogEntry[];
}

export interface DeviceLogIngestRequest {
	deviceId: string;
	timestamp: string;
	level: LogLevel;
	message: string;
	source: string;
}
