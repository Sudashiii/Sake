import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { QueueSearchBookUseCase } from '$lib/server/application/use-cases/QueueSearchBookUseCase';
import type { DownloadQueuePort, DownloadQueueTaskInput, QueueJobSnapshot } from '$lib/server/application/ports/DownloadQueuePort';

class FakeQueue implements DownloadQueuePort {
	enqueuedTask: DownloadQueueTaskInput | null = null;

	async enqueue(task: DownloadQueueTaskInput): Promise<string> {
		this.enqueuedTask = task;
		return 'provider-task-1';
	}

	async getStatus(): Promise<{ pending: number; processing: number }> {
		return { pending: 1, processing: 0 };
	}

	async getTasks(): Promise<QueueJobSnapshot[]> {
		return [];
	}
}

describe('QueueSearchBookUseCase', () => {
	test('queues provider imports through the shared queue port', async () => {
		const queue = new FakeQueue();
		const useCase = new QueueSearchBookUseCase(queue);

		const result = await useCase.execute({
			request: {
				provider: 'openlibrary',
				providerBookId: 'OL123W',
				downloadRef: 'ia:prideprejudice00aust_0',
				title: 'Pride and Prejudice',
				extension: 'epub',
				author: 'Jane Austen',
				series: 'Classics',
				volume: '2',
				seriesIndex: 2,
				identifier: 'OL123W',
				pages: 432,
				description: 'A classic novel.',
				cover: null,
				filesize: 123456,
				language: 'en',
				year: 1813
			},
			userId: 'user-1'
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(queue.enqueuedTask, {
			source: 'provider-import',
			provider: 'openlibrary',
			bookId: 'openlibrary:OL123W',
			downloadRef: 'ia:prideprejudice00aust_0',
			title: 'Pride and Prejudice',
			extension: 'epub',
			author: 'Jane Austen',
			publisher: null,
			series: 'Classics',
			volume: '2',
			seriesIndex: 2,
			edition: null,
			identifier: 'OL123W',
			pages: 432,
			description: 'A classic novel.',
			cover: null,
			filesize: 123456,
			language: 'en',
			year: 1813,
			userId: 'user-1',
			userKey: ''
		});

		assert.deepEqual(result.value, {
			success: true,
			taskId: 'provider-task-1',
			message: 'Provider import queued successfully',
			queueStatus: { pending: 1, processing: 0 }
		});
	});
});
