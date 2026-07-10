import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
// @ts-expect-error Bun's test-only mock API is available at runtime but excluded from the app tsconfig.
import { mock } from 'bun:test';

mock.module('$env/dynamic/private', () => ({ env: process.env }));

const { GET: getQueue } = await import('../../../../src/routes/api/queue/+server');
const { GET: getLegacyQueue } = await import('../../../../src/routes/api/zlibrary/queue/+server');

const unauthenticatedEvent = {
	locals: {
		auth: null,
		logger: undefined
	}
};

describe('queue status routes', () => {
	test('requires a session on the canonical queue endpoint', async () => {
		const response = await getQueue(unauthenticatedEvent as never);
		assert.equal(response.status, 401);
		assert.deepEqual(await response.json(), { error: 'Authentication required' });
	});

	test('keeps the legacy GET endpoint as an authenticated alias', async () => {
		const response = await getLegacyQueue(unauthenticatedEvent as never);
		assert.equal(response.status, 401);
		assert.deepEqual(await response.json(), { error: 'Authentication required' });
	});
});
