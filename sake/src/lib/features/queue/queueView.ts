import type { QueueJob, QueueJobStatus, QueueJobType } from '$lib/types/Queue/QueueStatus';

export type { QueueJob } from '$lib/types/Queue/QueueStatus';
export type QueueTab = 'all' | QueueJobStatus;

export const QUEUE_TABS: Array<{ key: QueueTab; label: string }> = [
	{ key: 'all', label: 'All' },
	{ key: 'queued', label: 'Queued' },
	{ key: 'processing', label: 'Processing' },
	{ key: 'completed', label: 'Completed' },
	{ key: 'skipped', label: 'Skipped' },
	{ key: 'failed', label: 'Failed' }
];

export function buildQueueCounts(queueJobs: QueueJob[]) {
	return {
		all: queueJobs.length,
		queued: queueJobs.filter((job) => job.status === 'queued').length,
		processing: queueJobs.filter((job) => job.status === 'processing').length,
		completed: queueJobs.filter((job) => job.status === 'completed').length,
		skipped: queueJobs.filter((job) => job.status === 'skipped').length,
		failed: queueJobs.filter((job) => job.status === 'failed').length
	};
}

export function filterQueueJobs(queueJobs: QueueJob[], activeTab: QueueTab): QueueJob[] {
	return activeTab === 'all' ? queueJobs : queueJobs.filter((job) => job.status === activeTab);
}

export function formatQueueDateTime(value: string): string {
	return new Date(value).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

export function statusLabel(status: QueueJobStatus): string {
	if (status === 'queued') return 'Queued';
	if (status === 'processing') return 'Processing';
	if (status === 'completed') return 'Completed';
	if (status === 'skipped') return 'Skipped';
	return 'Failed';
}

export function jobTypeLabel(type: QueueJobType): string {
	return type === 'book-download' ? 'Book download' : 'Hardcover sync';
}

export function getJobAuthor(job: QueueJob): string {
	const trimmedAuthor = job.author?.trim();
	return trimmedAuthor ? trimmedAuthor : `Book #${job.bookId}`;
}

export function getProgress(job: QueueJob): number | null {
	if (typeof job.targetProgressPercent !== 'number') {
		return null;
	}
	return Math.max(0, Math.min(100, job.targetProgressPercent));
}

export function getRetryLimit(job: QueueJob): number {
	if (job.maxRetries > 0) {
		return job.maxRetries;
	}
	return 3;
}
