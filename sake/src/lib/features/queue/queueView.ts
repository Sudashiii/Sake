export type QueueTab = 'all' | 'queued' | 'processing' | 'completed' | 'failed';

export interface QueueJob {
	id: string;
	bookId: string;
	title: string;
	status: 'queued' | 'processing' | 'completed' | 'failed';
	attempts: number;
	error?: string;
	createdAt: string;
	updatedAt: string;
	finishedAt?: string;
	author?: string;
	progress?: number;
	maxRetries?: number;
}

export const QUEUE_TABS: Array<{ key: QueueTab; label: string }> = [
	{ key: 'all', label: 'All' },
	{ key: 'queued', label: 'Queued' },
	{ key: 'processing', label: 'Processing' },
	{ key: 'completed', label: 'Completed' },
	{ key: 'failed', label: 'Failed' }
];

export function buildQueueCounts(queueJobs: QueueJob[]) {
	return {
		all: queueJobs.length,
		queued: queueJobs.filter((job) => job.status === 'queued').length,
		processing: queueJobs.filter((job) => job.status === 'processing').length,
		completed: queueJobs.filter((job) => job.status === 'completed').length,
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

export function statusLabel(status: QueueJob['status']): string {
	if (status === 'queued') return 'Queued';
	if (status === 'processing') return 'Processing';
	if (status === 'completed') return 'Completed';
	return 'Failed';
}

export function getJobAuthor(job: QueueJob): string {
	const trimmedAuthor = job.author?.trim();
	return trimmedAuthor ? trimmedAuthor : `Book #${job.bookId}`;
}

export function getProgress(job: QueueJob): number | null {
	if (typeof job.progress !== 'number') {
		return null;
	}
	return Math.max(0, Math.min(100, job.progress));
}

export function getRetryLimit(job: QueueJob): number {
	if (typeof job.maxRetries === 'number' && job.maxRetries > 0) {
		return job.maxRetries;
	}
	return 3;
}
