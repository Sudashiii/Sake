import pino, { type Logger } from 'pino';
import { webappLogFeed } from './webappLogFeed';

function resolveLogLevel(): string {
	return process.env.LOG_LEVEL?.trim() || 'info';
}

export function toLogError(error: unknown): { name: string; message: string; stack?: string } {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
		};
	}

	if (typeof error === 'string') {
		return {
			name: 'Error',
			message: error
		};
	}

	return {
		name: 'UnknownError',
		message: 'Unknown error'
	};
}

export const logger: Logger = pino({
	name: 'sake',
	level: resolveLogLevel(),
	base: {
		service: 'sake',
		env: process.env.NODE_ENV ?? 'development'
	}
}, pino.multistream([
	{
		stream: pino.transport({
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'SYS:standard',
				ignore: 'pid,hostname'
			}
		})
	},
	{
		stream: webappLogFeed
	}
]));

export function createChildLogger(bindings: Record<string, unknown>): Logger {
	return logger.child(bindings);
}
