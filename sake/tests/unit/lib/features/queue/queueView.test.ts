import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	buildQueueCounts,
	filterQueueJobs,
	getJobAuthor,
	getProgress,
	getRetryLimit,
	jobTypeLabel,
	statusLabel,
	type QueueJob
} from '$lib/features/queue/queueView';

const job = (overrides: Partial<QueueJob> = {}): QueueJob => ({
	id: '1',
	type: 'book-download',
	bookId: '42',
	title: 'Book',
	status: 'queued',
	attempts: 1,
	maxRetries: 3,
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
			job({ id: '5', status: 'failed' }),
			job({ id: '6', status: 'skipped' })
		]);

		assert.deepEqual(counts, {
			all: 6,
			queued: 1,
			processing: 2,
			completed: 1,
			skipped: 1,
			failed: 1
		});
	});

	test('filterQueueJobs narrows by active tab', () => {
		const jobs = [job({ status: 'queued' }), job({ id: '2', status: 'completed' })];
		assert.equal(filterQueueJobs(jobs, 'all').length, 2);
		assert.equal(filterQueueJobs(jobs, 'completed').length, 1);
	});

	test('progress and retry helpers keep fallback behavior', () => {
		assert.equal(getProgress(job({ targetProgressPercent: undefined })), null);
		assert.equal(getProgress(job({ targetProgressPercent: 140 })), 100);
		assert.equal(getRetryLimit(job({ maxRetries: 0 })), 3);
		assert.equal(getRetryLimit(job({ maxRetries: 5 })), 5);
	});

	test('statusLabel and getJobAuthor format output', () => {
		assert.equal(statusLabel('processing'), 'Processing');
		assert.equal(statusLabel('skipped'), 'Skipped');
		assert.equal(jobTypeLabel('book-download'), 'Book download');
		assert.equal(jobTypeLabel('hardcover-progress-sync'), 'Hardcover sync');
		assert.equal(getJobAuthor(job({ author: ' Author ' })), 'Author');
		assert.equal(getJobAuthor(job({ author: '   ' })), 'Book #42');
	});
});
