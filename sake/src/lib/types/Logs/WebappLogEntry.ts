import type { LogLevel } from './LogLevel';

export const WEBAPP_LOG_BACKLOG_LIMIT = 500;

export type WebappLogLevel = LogLevel;

export interface WebappLogError {
	name: string;
	message: string;
	stack?: string;
}

export interface WebappLogEntry {
	id: string;
	timestamp: string;
	level: WebappLogLevel;
	message: string;
	context: Record<string, unknown>;
	error?: WebappLogError;
}

export interface WebappLogSnapshot {
	entries: WebappLogEntry[];
}
