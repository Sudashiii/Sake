import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	buildQueueCounts,
	filterQueueJobs,
	getJobAuthor,
	getProgress,
	getRetryLimit,
	statusLabel,
	type QueueJob
} from '$lib/features/queue/queueView';

const job = (overrides: Partial<QueueJob> = {}): QueueJob => ({
	id: '1',
	bookId: '42',
	title: 'Book',
	status: 'queued',
	attempts: 1,
	createdAt: '2026-03-08T12:00:00.000Z',
	updatedAt: '2026-03-08T12:00:00.000Z',
	...overrides
});

describe('queueView', () => {
	test('buildQueueCounts returns counts per status', () => {
		const counts = buildQueueCounts([
			job({ status: 'queued' }),
			job({ id: '2', status: 'processing' }),
			job({ id: '3', status: 'processing' }),
			job({ id: '4', status: 'completed' }),
			job({ id: '5', status: 'failed' })
		]);

		assert.deepEqual(counts, {
			all: 5,
			queued: 1,
			processing: 2,
			completed: 1,
			failed: 1
		});
	});

	test('filterQueueJobs narrows by active tab', () => {
		const jobs = [job({ status: 'queued' }), job({ id: '2', status: 'completed' })];
		assert.equal(filterQueueJobs(jobs, 'all').length, 2);
		assert.equal(filterQueueJobs(jobs, 'completed').length, 1);
	});

	test('progress and retry helpers keep fallback behavior', () => {
		assert.equal(getProgress(job({ progress: undefined })), null);
		assert.equal(getProgress(job({ progress: 140 })), 100);
		assert.equal(getRetryLimit(job({ maxRetries: undefined })), 3);
		assert.equal(getRetryLimit(job({ maxRetries: 5 })), 5);
	});

	test('statusLabel and getJobAuthor format output', () => {
		assert.equal(statusLabel('processing'), 'Processing');
		assert.equal(getJobAuthor(job({ author: ' Author ' })), 'Author');
		assert.equal(getJobAuthor(job({ author: '   ' })), 'Book #42');
	});
});
