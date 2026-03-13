import type { Logger } from 'pino';
import { logger } from '$lib/server/infrastructure/logging/logger';

export function getRequestLogger(locals: App.Locals): Logger {
	return locals.logger ?? logger;
}
