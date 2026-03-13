export const PERSISTED_QUEUE_USER_KEY = '';

export const RECOVERY_REQUEUE_REQUIRED_ERROR =
	'Queued download could not resume after restart because credentials are not persisted. Requeue the download.';

export function sanitizePersistedQueueJob<T extends { userKey: string }>(job: T): T {
	return {
		...job,
		userKey: PERSISTED_QUEUE_USER_KEY
	};
}
