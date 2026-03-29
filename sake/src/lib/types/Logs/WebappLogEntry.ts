export const WEBAPP_LOG_BACKLOG_LIMIT = 500;

export type WebappLogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'unknown';

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
