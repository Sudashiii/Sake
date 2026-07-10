import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
	DownloadQueuePort,
	DownloadQueueTaskInput,
	QueueJobSnapshot
} from '$lib/server/application/ports/DownloadQueuePort';
import type {
	HardcoverProgressQueueJob,
	HardcoverProgressQueuePort
} from '$lib/server/application/ports/HardcoverProgressQueuePort';
import { GetQueueStatusUseCase } from '$lib/server/application/use-cases/GetQueueStatusUseCase';

class FakeDownloadQueue implements DownloadQueuePort {
	async enqueue(_task: DownloadQueueTaskInput): Promise<string> {
		return 'unused';
	}

	async getStatus() {
		return { pending: 1, processing: 0 };
	}

	async getTasks(): Promise<QueueJobSnapshot[]> {
		return [{
			id: 'download-id',
			bookId: 'external-42',
			title: 'Downloaded Book',
			status: 'queued',
			attempts: 0,
			maxRetries: 3,
			author: 'Download Author',
			createdAt: '2026-06-14T10:00:00.000Z',
			updatedAt: '2026-06-14T10:00:00.000Z'
		}];
	}
}

class FakeHardcoverQueue implements HardcoverProgressQueuePort {
	constructor(private readonly jobs: HardcoverProgressQueueJob[]) {}

	async counts() {
		return { pending: 0, processing: 0, completed: 0, failed: 1, skipped: 1 };
	}

	async activeCounts() {
		return { pending: 1, processing: 0 };
	}

	async listRecent(): Promise<HardcoverProgressQueueJob[]> {
		return this.jobs;
	}
}

describe('GetQueueStatusUseCase', () => {
	test('aggregates typed download and Hardcover jobs with namespaced IDs', async () => {
		const hardcoverJobs: HardcoverProgressQueueJob[] = [
			{
				id: 8,
				bookId: 12,
				title: 'Retrying Book',
				author: 'Sync Author',
				status: 'failed',
				sourceProgressPercent: 0.42,
				attempts: 2,
				nextAttemptAt: '2026-06-14T12:05:00.000Z',
				error: 'Hardcover rate limit reached. Sake will retry this job automatically.',
				outcome: null,
				createdAt: '2026-06-14T12:00:00.000Z',
				updatedAt: '2026-06-14T12:00:10.000Z',
				completedAt: null
			},
			{
				id: 7,
				bookId: 11,
				title: 'Skipped Book',
				author: null,
				status: 'skipped',
				sourceProgressPercent: 0.2,
				attempts: 1,
				nextAttemptAt: null,
				error: null,
				outcome: 'page_count_unavailable',
				createdAt: '2026-06-14T11:00:00.000Z',
				updatedAt: '2026-06-14T11:00:05.000Z',
				completedAt: '2026-06-14T11:00:05.000Z'
			}
		];
		const result = await new GetQueueStatusUseCase(
			new FakeDownloadQueue(),
			new FakeHardcoverQueue(hardcoverJobs)
		).execute();

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.deepEqual(result.value.queueStatus, { pending: 2, processing: 0 });
		assert.deepEqual(result.value.jobs.map((job) => job.id), [
			'hardcover-progress:8',
			'hardcover-progress:7',
			'download:download-id'
		]);
		assert.equal(result.value.jobs[0]?.type, 'hardcover-progress-sync');
		assert.equal(result.value.jobs[0]?.status, 'queued');
		assert.equal(result.value.jobs[0]?.targetProgressPercent, 42);
		assert.equal(result.value.jobs[0]?.nextAttemptAt, '2026-06-14T12:05:00.000Z');
		assert.equal(result.value.jobs[1]?.status, 'skipped');
		assert.match(result.value.jobs[1]?.outcomeMessage ?? '', /page count/i);
		assert.equal(result.value.jobs[2]?.type, 'book-download');
	});
});
