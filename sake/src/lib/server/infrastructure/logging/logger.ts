import pino, { type Logger } from 'pino';
import { webappLogFeed } from './webappLogFeed';

function resolveLogLevel(): string {
	return process.env.LOG_LEVEL?.trim() || 'info';
}

interface SerializedLogError {
	name: string;
	message: string;
	stack?: string;
	cause?: SerializedLogError | { message: string };
}

function serializeErrorCause(error: Error, depth = 0): SerializedLogError | { message: string } | undefined {
	if (depth >= 5) {
		return { message: 'Error cause chain truncated' };
	}

	const cause = error.cause;
	if (cause === undefined) {
		return undefined;
	}

	if (cause instanceof Error) {
		return {
			name: cause.name,
			message: cause.message,
			stack: process.env.NODE_ENV === 'production' ? undefined : cause.stack,
			cause: serializeErrorCause(cause, depth + 1)
		};
	}

	if (typeof cause === 'string') {
		return { message: cause };
	}

	if (typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string') {
		return { message: cause.message };
	}

	return { message: String(cause) };
}

export function toLogError(error: unknown): SerializedLogError {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
			cause: serializeErrorCause(error)
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
