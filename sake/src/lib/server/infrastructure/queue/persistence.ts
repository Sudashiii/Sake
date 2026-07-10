export const PERSISTED_QUEUE_USER_KEY = '';

export const QUEUE_TASK_PAYLOAD_VERSION = 1;

export const RECOVERY_REQUEUE_REQUIRED_ERROR =
	'Queued job could not resume after restart because its task payload is missing or invalid. Requeue the download.';

export const RECOVERY_ZLIBRARY_CREDENTIALS_MISSING_ERROR =
	'Z-Library queue job could not resume after restart because its credentials are intentionally not persisted. Requeue the download.';

export function sanitizePersistedQueueJob<T extends { userKey: string }>(job: T): T {
	return {
		...job,
		userKey: PERSISTED_QUEUE_USER_KEY
	};
}

export interface PersistedQueueTaskPayload<T> {
	version: typeof QUEUE_TASK_PAYLOAD_VERSION;
	task: T;
}

export function serializeQueueTask<T extends { userKey: string }>(task: T): string {
	const { userKey: _userKey, ...safeTask } = task;
	const payload: PersistedQueueTaskPayload<Omit<T, 'userKey'>> = {
		version: QUEUE_TASK_PAYLOAD_VERSION,
		task: safeTask
	};
	return JSON.stringify(payload);
}

export function parseQueueTask<T>(payload: string | null | undefined): T | null {
	if (!payload) {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(payload);
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('version' in parsed) ||
			parsed.version !== QUEUE_TASK_PAYLOAD_VERSION ||
			!('task' in parsed) ||
			typeof parsed.task !== 'object' ||
			parsed.task === null
		) {
			return null;
		}
		return parsed.task as T;
	} catch {
		return null;
	}
}
