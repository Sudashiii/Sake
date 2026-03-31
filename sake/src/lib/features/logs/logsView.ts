import type { DeviceLogEntry } from '$lib/types/Logs/DeviceLogEntry';
import type { LogLevel } from '$lib/types/Logs/LogLevel';
import type { WebappLogEntry, WebappLogLevel } from '$lib/types/Logs/WebappLogEntry';

export type LogsSource = 'webapp' | 'devices';

export interface LogsTabDefinition {
	key: LogsSource;
	label: string;
	available: boolean;
	description: string;
}

export const LOGS_TABS: LogsTabDefinition[] = [
	{
		key: 'webapp',
		label: 'Webapp',
		available: true,
		description: 'Live logs from the running Sake webapp process.'
	},
	{
		key: 'devices',
		label: 'Devices',
		available: true,
		description: 'Live logs shipped from connected Sake devices.'
	}
];

const LOG_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false
});

export function isLogsSourceAvailable(source: LogsSource): boolean {
	return source === 'webapp' || source === 'devices';
}

export function formatLogTimestamp(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return LOG_TIMESTAMP_FORMATTER.format(date);
}

export function formatLogLevel(level: WebappLogLevel | LogLevel): string {
	return level === 'unknown' ? 'UNKNOWN' : level.toUpperCase();
}

export function formatLogContextValue(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
		return String(value);
	}

	try {
		return JSON.stringify(value);
	} catch {
		return '[unserializable]';
	}
}

export function getContextPreview(entry: WebappLogEntry, limit = 3): Array<{ key: string; value: string }> {
	return Object.entries(entry.context)
		.slice(0, limit)
		.map(([key, value]) => ({
			key,
			value: formatLogContextValue(value)
		}));
}

export function hasLogDetails(entry: WebappLogEntry): boolean {
	return Object.keys(entry.context).length > 0 || Boolean(entry.error);
}

export function formatLogDetails(entry: WebappLogEntry): string {
	const payload: Record<string, unknown> = {};

	if (Object.keys(entry.context).length > 0) {
		payload.context = entry.context;
	}

	if (entry.error) {
		payload.error = entry.error;
	}

	return JSON.stringify(payload, null, 2);
}

export function formatDeviceLogSource(source: DeviceLogEntry['source']): string {
	const trimmed = source.trim();
	if (!trimmed) {
		return 'Unknown source';
	}

	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
