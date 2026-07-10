import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	PERSISTED_QUEUE_USER_KEY,
	parseQueueTask,
	RECOVERY_REQUEUE_REQUIRED_ERROR,
	sanitizePersistedQueueJob,
	serializeQueueTask
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

	test('versioned task payloads round-trip without credentials', () => {
		const payload = serializeQueueTask({
			source: 'provider-import' as const,
			userKey: 'not-persisted',
			userId: 'user-1',
			bookId: 'book-1',
			title: 'A book',
			extension: 'epub'
		});

		assert.equal(payload.includes('not-persisted'), false);
		assert.deepEqual(parseQueueTask(payload), {
			source: 'provider-import',
			userId: 'user-1',
			bookId: 'book-1',
			title: 'A book',
			extension: 'epub'
		});
	});

	test('invalid or unknown task payloads are rejected', () => {
		assert.equal(parseQueueTask('{"version":999,"task":{}}'), null);
		assert.equal(parseQueueTask('{"version":1,"task":null}'), null);
		assert.equal(parseQueueTask('not-json'), null);
	});
});
