import type { DeviceLogEntry } from '$lib/types/Logs/DeviceLogEntry';

export interface DeviceLogObservation {
	snapshot: DeviceLogEntry[];
	subscribe(listener: (entry: DeviceLogEntry) => void): () => void;
}

export interface AppendDeviceLogEntry {
	deviceId: string;
	timestamp: string;
	level: DeviceLogEntry['level'];
	message: string;
	source: string;
}

export interface DeviceLogFeedPort {
	append(entry: AppendDeviceLogEntry): DeviceLogEntry;
	observe(deviceId: string): DeviceLogObservation;
}
