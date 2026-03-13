import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	PERSISTED_QUEUE_USER_KEY,
	RECOVERY_REQUEUE_REQUIRED_ERROR,
	sanitizePersistedQueueJob
} from '$lib/server/infrastructure/queue/persistence';

describe('queue persistence', () => {
	test('sanitizePersistedQueueJob removes persisted user keys', () => {
		const sanitized = sanitizePersistedQueueJob({
			id: 'task-1',
			userKey: 'secret-user-key',
			userId: 'user-1'
		});

		assert.equal(sanitized.userKey, PERSISTED_QUEUE_USER_KEY);
		assert.equal(sanitized.userId, 'user-1');
		assert.equal(sanitized.id, 'task-1');
	});

	test('recovery error explains that jobs must be requeued after restart', () => {
		assert.match(RECOVERY_REQUEUE_REQUIRED_ERROR, /requeue/i);
		assert.match(RECOVERY_REQUEUE_REQUIRED_ERROR, /restart/i);
	});
});
